from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated, Literal, cast

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    ValidationError,
)

from app.db.models.user import UserRole


class ActionParseError(ValueError):
    pass


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
    )


class SearchDocsArguments(StrictModel):
    query: str = Field(
        min_length=1,
        max_length=500,
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=20,
    )


class GetDocumentArguments(StrictModel):
    document_id: str = Field(
        min_length=1,
        max_length=100,
    )


class SearchDocsProposal(StrictModel):
    name: Literal["search_docs"]
    arguments: SearchDocsArguments


class GetDocumentProposal(StrictModel):
    name: Literal["get_document"]
    arguments: GetDocumentArguments


ActionProposal = Annotated[
    SearchDocsProposal | GetDocumentProposal, Field(discriminator="name")
]

ActionProposalAdapter = TypeAdapter(ActionProposal)

Constraint = Callable[[BaseModel], bool]


@dataclass(frozen=True)
class ActionDefinition:
    name: str
    proposal_model: type[BaseModel]
    min_role: UserRole
    constraints: tuple[Constraint, ...] = ()


class ActionRegistry:
    def __init__(
        self,
        definitions: list[ActionDefinition] | None = None,
    ):
        self._actions: dict[str, ActionDefinition] = {}

        for definition in definitions or []:
            self.register(definition)

    def register(
        self,
        definition: ActionDefinition,
    ) -> None:
        if definition.name in self._actions:
            raise ValueError(f"Action already registered: {definition.name}")

        self._actions[definition.name] = definition

    def get(
        self,
        name: str,
    ) -> ActionDefinition:

        try:
            return self._actions[name]

        except KeyError as exc:
            raise ActionParseError(f"Unknown action: {name}") from exc

    def parse_proposal(
        self,
        raw_json: str | bytes,
    ) -> ActionProposal:
        try:
            payload = json.loads(raw_json)

        except (
            json.JSONDecodeError,
            UnicodeDecodeError,
            TypeError,
        ) as exc:
            raise ActionParseError("Invalid action JSON") from exc

        if not isinstance(payload, dict):
            raise ActionParseError("Action proposal must be a JSON object")

        name = payload.get("name")

        if not isinstance(name, str):
            raise ActionParseError("Action proposal requires a string name")

        definition = self.get(name)

        try:
            proposal = definition.proposal_model.model_validate(payload)
        except ValidationError as exc:
            raise ActionParseError(f"Invalid parameters for action: {name}") from exc

        return cast(ActionProposal, proposal)


DEFAULT_ACTION_REGISTRY = ActionRegistry(
    definitions=[
        ActionDefinition(
            name="search_docs",
            proposal_model=SearchDocsProposal,
            min_role=UserRole.USER,
        ),
        ActionDefinition(
            name="get_document",
            proposal_model=GetDocumentProposal,
            min_role=UserRole.USER,
        ),
    ]
)
