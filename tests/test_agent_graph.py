import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.agents.graph import AgentGraph
from app.db.base import Base
from app.db.models.user import UserRole
from app.policies.actions import (
    DEFAULT_ACTION_REGISTRY,
    ActionDefinition,
    ActionRegistry,
    SearchDocsProposal,
)
from app.policies.gate import PolicyGate
from app.services.llm.provider import Message


@dataclass(frozen=True)
class SearchResult:
    document_id: str
    chunk_index: int
    text: str
    heading: str | None
    score: float


class FakeLLMProvider:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.call_count = 0
        self.received_messages: list[Sequence[Message]] = []

    async def complete(self, messages: Sequence[Message], **kwargs: Any) -> str:
        self.received_messages.append(messages)
        if self.call_count < len(self.responses):
            response = self.responses[self.call_count]
            self.call_count += 1
            return response
        return "Default completion response"

    async def stream(self, messages: Sequence[Message], **kwargs: Any):
        response = await self.complete(messages, **kwargs)
        yield response


class FakeVectorStore:
    def __init__(self, results: list[SearchResult] | None = None) -> None:
        self.results = results or [
            SearchResult(
                document_id="doc-1",
                chunk_index=0,
                text="Authentication guidelines: use JWT HS256 tokens.",
                heading="Authentication",
                score=0.95,
            )
        ]
        self.last_query = ""
        self.last_k = 0

    async def ensure_collection(self) -> None:
        pass

    async def upsert_chunks(self, chunks: Any) -> None:
        pass

    async def hybrid_search(self, query: str, k: int = 5) -> list[SearchResult]:
        self.last_query = query
        self.last_k = k
        return self.results[:k]


@pytest_asyncio.fixture
async def agent_session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield session_factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_agent_graph_executes_permitted_action(agent_session_factory):
    tool_json = json.dumps(
        {
            "name": "search_docs",
            "arguments": {
                "query": "authentication",
                "limit": 3,
            },
        }
    )
    final_answer = "Based on our documents, JWT HS256 tokens are recommended."
    fake_llm = FakeLLMProvider([tool_json, final_answer])
    fake_vector_store = FakeVectorStore()

    graph = AgentGraph(
        llm=fake_llm,
        registry=DEFAULT_ACTION_REGISTRY,
        vector_store=fake_vector_store,
        session_factory=agent_session_factory,
    )

    user = {"id": "user-001", "role": UserRole.USER.value}
    initial_state = {
        "messages": [{"role": "user", "content": "How do we handle authentication?"}],
        "user": user,
    }

    result = await graph.app.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": "thread-1"}},
    )

    assert result["status"] == "completed"
    assert result["decision"] is not None
    assert result["decision"].allowed is True
    assert fake_vector_store.last_query == "authentication"
    assert fake_vector_store.last_k == 3
    assert result["final_response"] == final_answer
    assert len(result["action_result"]) == 1
    assert result["action_result"][0]["document_id"] == "doc-1"


@pytest.mark.asyncio
async def test_agent_graph_blocks_unauthorized_action(agent_session_factory):
    admin_registry = ActionRegistry(
        [
            ActionDefinition(
                name="search_docs",
                proposal_model=SearchDocsProposal,
                min_role=UserRole.ADMIN,
            )
        ]
    )
    gate = PolicyGate(admin_registry)

    tool_json = json.dumps(
        {
            "name": "search_docs",
            "arguments": {
                "query": "classified",
                "limit": 5,
            },
        }
    )
    fake_llm = FakeLLMProvider([tool_json])
    fake_vector_store = FakeVectorStore()

    graph = AgentGraph(
        llm=fake_llm,
        registry=admin_registry,
        gate=gate,
        vector_store=fake_vector_store,
        session_factory=agent_session_factory,
    )

    regular_user = {"id": "user-002", "role": UserRole.USER.value}
    initial_state = {
        "messages": [{"role": "user", "content": "Search classified documents"}],
        "user": regular_user,
    }

    result = await graph.app.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": "thread-2"}},
    )

    assert result["status"] == "completed"
    assert result["decision"] is not None
    assert result["decision"].allowed is False
    assert "Action blocked by AegisAI Policy Gate" in result["final_response"]
    assert "Insufficient role" in result["final_response"]
    assert result.get("action_result") is None
    assert fake_vector_store.last_query == ""


@pytest.mark.asyncio
async def test_agent_graph_handles_conversational_response_without_tools(agent_session_factory):
    conversational_reply = "Hello! I am AegisAI assistant. How can I help you today?"
    fake_llm = FakeLLMProvider([conversational_reply])
    fake_vector_store = FakeVectorStore()

    graph = AgentGraph(
        llm=fake_llm,
        registry=DEFAULT_ACTION_REGISTRY,
        vector_store=fake_vector_store,
        session_factory=agent_session_factory,
    )

    user = {"id": "user-003", "role": UserRole.USER.value}
    initial_state = {
        "messages": [{"role": "user", "content": "Hello!"}],
        "user": user,
    }

    result = await graph.app.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": "thread-3"}},
    )

    assert result["status"] == "completed"
    assert result.get("proposal") is None
    assert result.get("decision") is None
    assert result.get("action_result") is None
    assert result["final_response"] == conversational_reply
