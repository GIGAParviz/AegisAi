from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, TypedDict
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.db.engine import async_session_factory
from app.db.models.document import Document
from app.policies.actions import (
    DEFAULT_ACTION_REGISTRY,
    ActionParseError,
    ActionProposal,
    ActionRegistry,
)
from app.policies.gate import GateDecision, PolicyGate
from app.services.llm import LLMProvider, build_llm_provider
from app.services.verifier import verify

if TYPE_CHECKING:
    from app.services.vector_store import VectorStore


class AgentState(TypedDict, total=False):
    messages: list[dict[str, str]]
    user: Any
    session: AsyncSession | None
    proposal_raw: str | None
    proposal: ActionProposal | None
    decision: GateDecision | None
    action_result: Any | None
    final_response: str | None
    status: str
    repair_count: int
    verification_errors: list[str]


class SearchResultItem(BaseModel):
    document_id: str = Field(min_length=1)
    chunk_index: int = Field(ge=0)
    text: str
    heading: str | None = None
    score: float


class SearchResultsOutput(BaseModel):
    results: list[SearchResultItem]


class DocumentOutput(BaseModel):
    id: str = Field(min_length=1)
    filename: str = Field(min_length=1)
    mime: str = Field(min_length=1)
    status: str = Field(min_length=1)
    created_at: str = Field(min_length=1)


def _user_id(user: Any) -> str | None:
    value = user.get("id") if isinstance(user, dict) else getattr(user, "id", None)
    return str(value) if value is not None else None


async def _execute_search_docs(
    arguments: Any,
    vector_store: VectorStore,
    user: Any,
) -> dict[str, list[dict[str, Any]]]:
    query = str(arguments.query)
    limit = int(arguments.limit)
    results = await vector_store.hybrid_search(
        query=query,
        k=limit,
        owner_id=_user_id(user),
    )
    return {
        "results": [
            {
                "document_id": item.document_id,
                "chunk_index": item.chunk_index,
                "text": item.text,
                "heading": item.heading,
                "score": item.score,
            }
            for item in results
        ]
    }


async def _execute_get_document(
    arguments: Any,
    session: AsyncSession,
    user: Any,
) -> dict[str, Any]:
    try:
        doc_uuid = UUID(str(arguments.document_id))
    except ValueError as exc:
        raise ValueError(f"Invalid document UUID: {arguments.document_id}") from exc

    owner_id = _user_id(user)
    if owner_id is None:
        raise ValueError("A user identity is required to read documents")
    try:
        owner_uuid = UUID(owner_id)
    except ValueError as exc:
        raise ValueError("Invalid user identity") from exc

    result = await session.execute(
        select(Document).where(
            Document.id == doc_uuid,
            Document.owner_id == owner_uuid,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise ValueError(f"Document not found: {arguments.document_id}")

    return {
        "id": str(document.id),
        "filename": document.filename,
        "mime": document.mime,
        "status": document.status.value,
        "created_at": document.created_at.isoformat(),
    }


class AgentGraph:
    def __init__(
        self,
        llm: LLMProvider | None = None,
        registry: ActionRegistry | None = None,
        gate: PolicyGate | None = None,
        vector_store: VectorStore | Any | None = None,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        checkpointer: Any | None = None,
    ) -> None:
        self.llm = llm or build_llm_provider()
        self.registry = registry or DEFAULT_ACTION_REGISTRY
        self.gate = gate or PolicyGate(self.registry)
        if vector_store is not None:
            self.vector_store = vector_store
        else:
            from app.services.embeddings import build_embedding_provider
            from app.services.vector_store import build_vector_store

            self.vector_store = build_vector_store(build_embedding_provider())

        self.session_factory = session_factory or async_session_factory

        if checkpointer is None:
            if settings.environment.lower() in {"production", "prod"}:
                raise RuntimeError(
                    "Production AgentGraph requires a persistent checkpointer"
                )
            checkpointer = MemorySaver()

        self.checkpointer = checkpointer
        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentState)

        workflow.add_node("reason", self._reason_node)
        workflow.add_node("propose", self._propose_node)
        workflow.add_node("gate", self._gate_node)
        workflow.add_node("execute", self._execute_node)
        workflow.add_node("verify", self._verify_node)
        workflow.add_node("respond", self._respond_node)

        workflow.add_edge(START, "reason")
        workflow.add_edge("reason", "propose")

        workflow.add_conditional_edges(
            "propose",
            self._route_after_propose,
            {
                "gate": "gate",
                "respond": "respond",
            },
        )

        workflow.add_conditional_edges(
            "gate",
            self._route_after_gate,
            {
                "execute": "execute",
                "respond": "respond",
            },
        )

        workflow.add_edge("execute", "verify")

        workflow.add_conditional_edges(
            "verify",
            self._route_after_verify,
            {
                "reason": "reason",
                "respond": "respond",
            },
        )

        workflow.add_edge("respond", END)
        return workflow.compile(checkpointer=self.checkpointer)

    def _run_config(
        self,
        thread_id: str,
        checkpoint_id: str | None = None,
    ) -> dict[str, Any]:
        if not thread_id.strip():
            raise ValueError("thread_id must not be empty")

        configurable: dict[str, str] = {
            "thread_id": thread_id,
        }

        if checkpoint_id is not None:
            configurable["checkpoint_id"] = checkpoint_id

        return {"configurable": configurable}

    async def ainvoke(
        self,
        state: AgentState,
        thread_id: str,
        checkpoint_id: str | None = None,
    ) -> AgentState:
        return await self.app.ainvoke(
            state,
            config=self._run_config(thread_id, checkpoint_id),
        )

    async def aget_state(
        self,
        thread_id: str,
        checkpoint_id: str | None = None,
    ) -> Any:
        return await self.app.aget_state(
            self._run_config(thread_id, checkpoint_id),
        )

    async def aget_state_history(
        self,
        thread_id: str,
        limit: int = 20,
    ) -> list[Any]:
        if limit <= 0:
            raise ValueError("limit must be greater than zero")

        snapshots = []

        async for snapshot in self.app.aget_state_history(
            self._run_config(thread_id),
            limit=limit,
        ):
            snapshots.append(snapshot)

        return snapshots

    async def _reason_node(self, state: AgentState) -> dict[str, Any]:
        messages = state.get("messages", [])
        verification_errors = state.get("verification_errors", [])
        if verification_errors:
            messages = [
                *messages,
                {
                    "role": "user",
                    "content": (
                        "The previous action result failed verification. "
                        "Return a corrected action proposal only. Errors: "
                        f"{json.dumps(verification_errors, ensure_ascii=False)}"
                    ),
                },
            ]
        response = await self.llm.complete(messages)

        new_messages = list(messages)
        new_messages.append({"role": "assistant", "content": response})

        return {
            "messages": new_messages,
            "proposal_raw": response,
            "status": "in_progress",
            "verification_errors": [],
        }

    async def _propose_node(self, state: AgentState) -> dict[str, Any]:
        raw_output = state.get("proposal_raw", "").strip()

        try:
            proposal = self.registry.parse_proposal(raw_output)
            return {"proposal": proposal}
        except ActionParseError:
            return {"proposal": None}

    async def _gate_node(self, state: AgentState) -> dict[str, Any]:
        proposal = state.get("proposal")
        user = state.get("user")
        session = state.get("session")

        if session is not None:
            decision = await self.gate.check(proposal, user, session)
        else:
            async with self.session_factory() as local_session:
                decision = await self.gate.check(proposal, user, local_session)
                await local_session.commit()

        status = "in_progress" if decision.allowed else "denied"
        return {
            "decision": decision,
            "status": status,
        }

    async def _execute_node(self, state: AgentState) -> dict[str, Any]:
        proposal = state.get("proposal")
        if proposal is None:
            return {"action_result": None}

        action_name = getattr(proposal, "name", "")
        arguments = getattr(proposal, "arguments", None)
        user = state.get("user")
        session = state.get("session")

        if action_name == "search_docs":
            action_result = await _execute_search_docs(
                arguments,
                self.vector_store,
                user,
            )
        elif action_name == "get_document":
            if session is not None:
                action_result = await _execute_get_document(arguments, session, user)
            else:
                async with self.session_factory() as local_session:
                    action_result = await _execute_get_document(
                        arguments,
                        local_session,
                        user,
                    )
        else:
            raise ValueError(f"No execution handler registered for action: {action_name}")

        return {"action_result": action_result}

    async def _verify_node(self, state: AgentState) -> dict[str, Any]:
        result = state.get("action_result")
        proposal = state.get("proposal")
        schema = {
            "search_docs": SearchResultsOutput,
            "get_document": DocumentOutput,
        }.get(getattr(proposal, "name", ""))
        v_res = verify(result, schema=schema)
        if not v_res.is_valid:
            repair_count = state.get("repair_count", 0) + 1
            return {
                "action_result": None,
                "repair_count": repair_count,
                "verification_errors": v_res.errors,
                "status": "repair_needed" if repair_count <= 2 else "error",
            }
        return {"status": "in_progress", "verification_errors": []}

    async def _respond_node(self, state: AgentState) -> dict[str, Any]:
        status = state.get("status")
        if status == "denied":
            decision = state.get("decision")
            reason = decision.reason if decision else "Security policy denied action"
            return {
                "final_response": f"Action blocked by AegisAI Policy Gate: {reason}",
                "status": "completed",
            }
        if status == "error":
            return {
                "final_response": "Action execution failed output verification rules.",
                "status": "error",
            }

        action_result = state.get("action_result")
        if action_result is not None:
            messages = [
                *state.get("messages", []),
                {
                    "role": "user",
                    "content": f"Action executed with result: {json.dumps(action_result, ensure_ascii=False)}. Formulate the final answer for the user.",
                },
            ]
            final_text = await self.llm.complete(messages)
        else:
            final_text = state.get("proposal_raw", "")

        return {
            "final_response": final_text,
            "status": "completed",
        }

    def _route_after_propose(self, state: AgentState) -> str:
        if state.get("proposal") is not None:
            return "gate"
        return "respond"

    def _route_after_gate(self, state: AgentState) -> str:
        decision = state.get("decision")
        if decision is not None and decision.allowed:
            return "execute"
        return "respond"

    def _route_after_verify(self, state: AgentState) -> str:
        if state.get("status") == "repair_needed":
            return "reason"
        return "respond"
