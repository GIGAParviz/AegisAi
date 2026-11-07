from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph import AgentGraph
from app.api.deps import require_roles
from app.db.engine import get_session
from app.db.models.approval import Approval, ApprovalStatus
from app.db.models.policy_audit import PolicyAudit, PolicyDecision
from app.db.models.user import User, UserRole
from app.schemas.approval import (
    ApprovalDecisionRequest,
    ApprovalDecisionResponse,
    ApprovalResponse,
)

router = APIRouter(
    prefix="/approvals",
    tags=["approvals"],
)


def get_agent_graph(request: Request) -> AgentGraph:
    graph = getattr(request.app.state, "agent_graph", None)
    if graph is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent runtime is not enabled in this environment",
        )
    return graph


@router.get("", response_model=list[ApprovalResponse])
async def list_pending_approvals(
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
) -> list[Approval]:
    result = await session.execute(
        select(Approval)
        .where(Approval.status == ApprovalStatus.PENDING)
        .order_by(Approval.created_at)
    )
    return list(result.scalars().all())


@router.post(
    "/{approval_id}/decision",
    response_model=ApprovalDecisionResponse,
)
async def decide_approval(
    approval_id: UUID,
    body: ApprovalDecisionRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
    graph: Annotated[AgentGraph, Depends(get_agent_graph)],
) -> ApprovalDecisionResponse:
    result = await session.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()

    if approval is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval not found",
        )

    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval already decided",
        )

    approved = body.decision == "approve"
    approval.status = ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED
    approval.decided_by = admin.id
    approval.decided_at = datetime.now(UTC)

    session.add(
        PolicyAudit(
            actor_id=str(admin.id),
            action=approval.action,
            decision=PolicyDecision.ALLOW if approved else PolicyDecision.DENY,
            reason=f"Human decision: {approval.status.value}",
            proposal_json=approval.proposal_json,
        )
    )
    await session.commit()

    graph_result = await graph.aresume(
        approval.graph_run_id,
        {"approved": approved, "decided_by": str(admin.id)},
    )

    return ApprovalDecisionResponse(
        approval=ApprovalResponse.model_validate(approval),
        final_response=graph_result.get("final_response"),
    )
