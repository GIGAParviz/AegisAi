from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.policy_audit import PolicyAudit, PolicyDecision
from app.db.models.user import UserRole
from app.policies.actions import (
    DEFAULT_ACTION_REGISTRY,
    ActionDefinition,
    ActionParseError,
    ActionProposal,
    ActionRegistry,
)

ROLE_HIERARCHY: dict[UserRole, int] = {
    UserRole.USER: 1,
    UserRole.AGENT: 2,
    UserRole.ADMIN: 3,
}


@dataclass(frozen=True)
class GateDecision:
    allowed: bool
    decision: PolicyDecision
    reason: str
    audit_id: UUID
    action: str
    proposal: ActionProposal | None = None


class PolicyGate:
    def __init__(
        self,
        registry: ActionRegistry | None = None,
    ) -> None:
        self.registry = registry or DEFAULT_ACTION_REGISTRY

    async def check(
        self,
        proposal_input: ActionProposal | dict[str, Any] | str | bytes,
        user: Any,
        session: AsyncSession,
    ) -> GateDecision:
        actor_id = str(getattr(user, "id", "anonymous"))
        user_role = getattr(user, "role", UserRole.USER)
        if isinstance(user_role, str):
            try:
                user_role = UserRole(user_role)
            except ValueError:
                user_role = UserRole.USER

        action_name = "unknown"
        raw_json_str = ""
        proposal_obj: ActionProposal | None = None

        if isinstance(proposal_input, BaseModel):
            proposal_obj = proposal_input  # type: ignore
            action_name = getattr(proposal_input, "name", "unknown")
            raw_json_str = proposal_input.model_dump_json()
        elif isinstance(proposal_input, (str, bytes)):
            raw_json_str = (
                proposal_input.decode("utf-8")
                if isinstance(proposal_input, bytes)
                else proposal_input
            )
            try:
                payload = json.loads(raw_json_str)
                if isinstance(payload, dict):
                    action_name = str(payload.get("name", "unknown"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                action_name = "unknown"
        elif isinstance(proposal_input, dict):
            raw_json_str = json.dumps(proposal_input)
            action_name = str(proposal_input.get("name", "unknown"))

        decision = PolicyDecision.DENY
        reason = "Denied by default"

        definition: ActionDefinition | None = None
        try:
            definition = self.registry.get(action_name)
        except ActionParseError:
            reason = f"Unknown action: {action_name}"

        if definition is not None and proposal_obj is None:
            try:
                proposal_obj = self.registry.parse_proposal(raw_json_str)
            except ActionParseError as exc:
                reason = f"Invalid parameters for {action_name}: {exc}"
                definition = None

        if definition is not None and proposal_obj is not None:
            user_level = ROLE_HIERARCHY.get(user_role, 0)
            required_level = ROLE_HIERARCHY.get(definition.min_role, 0)

            if user_level < required_level:
                reason = (
                    f"Insufficient role: user has {user_role.value}, "
                    f"action requires {definition.min_role.value}"
                )
            else:
                violated = False
                for constraint in definition.constraints:
                    try:
                        if not constraint(proposal_obj):
                            violated = True
                            reason = f"Constraint violation for action: {action_name}"
                            break
                    except Exception as exc:  # noqa: BLE001
                        violated = True
                        reason = f"Constraint evaluation error: {exc}"
                        break

                if not violated:
                    decision = PolicyDecision.ALLOW
                    reason = "Action permitted by policy gate"

        audit_entry = PolicyAudit(
            actor_id=actor_id,
            action=action_name,
            decision=decision,
            reason=reason,
            proposal_json=raw_json_str,
        )
        session.add(audit_entry)
        await session.flush()

        return GateDecision(
            allowed=(decision == PolicyDecision.ALLOW),
            decision=decision,
            reason=reason,
            audit_id=audit_entry.id,
            action=action_name,
            proposal=proposal_obj,
        )
