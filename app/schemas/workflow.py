import json
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.policies.actions import DEFAULT_ACTION_REGISTRY


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class AgentWrite(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    system_prompt: str = Field(max_length=16000)
    model: str = Field(default="", max_length=200)
    allowed_tools: list[str] = Field(default_factory=list, max_length=20)
    requires_approval: bool = False

    @field_validator("allowed_tools")
    @classmethod
    def known_tools(cls, value):
        known = {item.name for item in DEFAULT_ACTION_REGISTRY.definitions()}
        if len(value) != len(set(value)) or not set(value) <= known:
            raise ValueError("Only registered tools may be selected")
        return value


class AgentResponse(AgentWrite):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime


class EmptyConfig(StrictModel):
    pass


class LLMConfig(StrictModel):
    agent_id: str | None = None
    prompt: str = Field(min_length=1, max_length=16000)


class RetrieveConfig(StrictModel):
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)


class ToolConfig(StrictModel):
    name: Literal["search_docs", "get_document"]
    arguments: dict[str, Any]

    @model_validator(mode="after")
    def valid_arguments(self):
        DEFAULT_ACTION_REGISTRY.parse_proposal(self.model_dump_json())
        return self


class ConditionConfig(StrictModel):
    contains: str = Field(min_length=1, max_length=500)


class ApprovalConfig(StrictModel):
    message: str = Field(min_length=1, max_length=2000)


CONFIGS = {"start": EmptyConfig, "end": EmptyConfig, "llm": LLMConfig,
           "retrieve": RetrieveConfig, "tool": ToolConfig,
           "condition": ConditionConfig, "approval": ApprovalConfig}


def validate_templates(value):
    if isinstance(value, str):
        rest = value.replace("{{input}}", "").replace("{{previous}}", "")
        if "{{" in rest or "}}" in rest:
            raise ValueError("Only {{input}} and {{previous}} templates are supported")
    elif isinstance(value, dict):
        for item in value.values():
            validate_templates(item)
    elif isinstance(value, list):
        for item in value:
            validate_templates(item)


class Position(StrictModel):
    x: float
    y: float


class Node(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    type: Literal["start", "llm", "retrieve", "tool", "condition", "approval", "end"]
    position: Position
    config: dict[str, Any]

    @model_validator(mode="after")
    def typed_config(self):
        validate_templates(self.config)
        self.config = CONFIGS[self.type].model_validate(self.config).model_dump()
        return self


class Edge(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    source: str
    target: str
    sourceHandle: str | None = None


class WorkflowWrite(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=4000)
    nodes: list[Node] = Field(min_length=2, max_length=50)
    edges: list[Edge] = Field(max_length=100)

    @model_validator(mode="after")
    def valid_dag(self):
        if len(json.dumps(self.model_dump(mode="json"))) > 128000:
            raise ValueError("Workflow size limit exceeded")
        nodes = {n.id: n for n in self.nodes}
        if len(nodes) != len(self.nodes) or len({e.id for e in self.edges}) != len(self.edges):
            raise ValueError("Node and edge IDs must be unique")
        starts = [n.id for n in self.nodes if n.type == "start"]
        if len(starts) != 1 or not any(n.type == "end" for n in self.nodes):
            raise ValueError("Exactly one start and at least one end required")
        outgoing = {n: [] for n in nodes}
        for edge in self.edges:
            if edge.source not in nodes or edge.target not in nodes:
                raise ValueError("Dangling edge")
            if edge.target == starts[0]:
                raise ValueError("Start cannot have incoming edges")
            outgoing[edge.source].append(edge)
        for identifier, node in nodes.items():
            edges = outgoing[identifier]
            if node.type == "end":
                if edges:
                    raise ValueError("End must have no outgoing edges")
            elif node.type == "condition":
                if len(edges) != 2 or {e.sourceHandle for e in edges} != {"true", "false"}:
                    raise ValueError("Condition requires true and false branches")
            elif len(edges) != 1 or edges[0].sourceHandle is not None:
                raise ValueError("Node requires one unlabelled outgoing edge")
        visited, active = set(), set()
        def visit(identifier):
            if identifier in active:
                raise ValueError("Cycles are not allowed")
            if identifier in visited:
                return
            active.add(identifier)
            for edge in outgoing[identifier]:
                visit(edge.target)
            active.remove(identifier)
            visited.add(identifier)
        visit(starts[0])
        if visited != set(nodes):
            raise ValueError("All nodes must be reachable from start")
        return self


class WorkflowResponse(WorkflowWrite):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime


class DecisionRequest(StrictModel):
    decision: Literal["approve", "reject"]


class RunRequest(StrictModel):
    input: str = Field(max_length=16000)


class NodeResult(BaseModel):
    node_id: str
    status: str
    output: Any = None
    error: str | None = None


class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    workflow_id: UUID
    status: Literal["running", "completed", "failed", "awaiting_approval", "rejected"]
    input: str
    output: str | None
    error: str | None
    node_results: list[NodeResult]
    pending_node_id: str | None
    created_at: datetime
