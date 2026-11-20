import json
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.agents.graph import AgentGraph
from app.api.middleware.tracing import RequestTracingMiddleware
from app.core.config import settings
from app.db.models.user import UserRole
from app.observability import tracing
from app.policies.gate import PolicyGate
from app.services.context_builder import build as build_context
from app.services.llm.provider import OpenAICompatProvider
from app.services.verifier import verify


@dataclass
class SpanRecord:
    name: str
    as_type: str
    parent: str | None
    input: object = None
    metadata: object = None
    model: str | None = None
    updates: list[dict[str, object]] = field(default_factory=list)


class FakeObservation:
    def __init__(self, record: SpanRecord) -> None:
        self.record = record

    def update(self, **kwargs: object) -> None:
        self.record.updates.append(kwargs)


class FakeLangfuse:
    def __init__(self) -> None:
        self.records: list[SpanRecord] = []
        self.current: ContextVar[str | None] = ContextVar("fake_langfuse_current", default=None)

    def start_as_current_observation(self, **kwargs: object):
        @contextmanager
        def manager():
            record = SpanRecord(
                name=str(kwargs["name"]),
                as_type=str(kwargs.get("as_type", "span")),
                parent=self.current.get(),
                input=kwargs.get("input"),
                metadata=kwargs.get("metadata"),
                model=kwargs.get("model"),
            )
            self.records.append(record)
            token = self.current.set(record.name)
            try:
                yield FakeObservation(record)
            finally:
                self.current.reset(token)

        return manager()


@dataclass(frozen=True)
class FakeSearchResult:
    document_id: str
    chunk_index: int
    text: str
    heading: str | None
    score: float


class FakeVectorStore:
    async def hybrid_search(self, query: str, k: int = 5, owner_id: str | None = None):
        return [
            FakeSearchResult(
                document_id="doc-1",
                chunk_index=0,
                text="safe result",
                heading="Source",
                score=0.9,
            )
        ][:k]


class FakeAgentLLM:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)

    async def complete(self, messages, **kwargs):
        return self.responses.pop(0)

    async def stream(self, messages, **kwargs):
        yield await self.complete(messages, **kwargs)


@pytest.mark.asyncio
async def test_request_tracing_nests_component_spans_and_records_usage(
    monkeypatch,
    session_factory,
    db_session,
):
    fake_langfuse = FakeLangfuse()
    monkeypatch.setattr(tracing, "_get_client", lambda: fake_langfuse)
    user = SimpleNamespace(
        id=UUID("f41d5bbf-cfb4-4125-943e-07e7ac7151a6"),
        role=UserRole.USER,
    )

    def llm_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"role": "assistant", "content": "answer"}}],
                "usage": {
                    "prompt_tokens": 5,
                    "completion_tokens": 2,
                    "total_tokens": 7,
                    "cost": 0.001,
                },
            },
        )

    provider = OpenAICompatProvider(
        base_url="https://test.local/v1",
        api_key="test-key",
        model="test-model",
        transport=httpx.MockTransport(llm_handler),
    )
    redis = FakeRedis(decode_responses=True)
    app = FastAPI()
    app.add_middleware(RequestTracingMiddleware)

    @app.get("/trace-probe")
    async def trace_probe():
        request_id = tracing.get_trace_id()
        await build_context(
            query="private query",
            session_id="session-1",
            user=user,
            redis_client=redis,
            vector_store=FakeVectorStore(),
            session_factory=session_factory,
        )
        await provider.complete([{"role": "user", "content": "private prompt"}])
        await PolicyGate().check(
            {
                "name": "search_docs",
                "arguments": {"query": "private query", "limit": 2},
            },
            user,
            db_session,
        )
        verify({"ok": True})
        return {"trace_id": request_id}

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/trace-probe")

    await redis.aclose()
    assert response.status_code == 200
    request_id = response.json()["trace_id"]
    assert response.headers["x-request-id"] == request_id
    assert response.headers["x-trace-id"] == request_id

    assert [record.name for record in fake_langfuse.records] == [
        "http.request",
        "context.build",
        "llm.complete",
        "policy.gate",
        "verifier.verify",
    ]
    assert all(record.parent == "http.request" for record in fake_langfuse.records[1:])
    assert fake_langfuse.records[0].metadata["request_id"] == request_id
    assert fake_langfuse.records[2].as_type == "generation"
    assert fake_langfuse.records[2].model == "test-model"
    llm_updates = fake_langfuse.records[2].updates
    assert llm_updates[0]["usage_details"] == {"input": 5, "output": 2, "total": 7}
    assert llm_updates[0]["cost_details"] == {"total": 0.001}
    assert "private query" not in json.dumps(
        [record.input for record in fake_langfuse.records],
        default=str,
    )


@pytest.mark.asyncio
async def test_tracing_is_noop_without_both_langfuse_keys(monkeypatch):
    monkeypatch.setattr(settings, "langfuse_public_key", "")
    monkeypatch.setattr(settings, "langfuse_secret_key", "")
    app = FastAPI()
    app.add_middleware(RequestTracingMiddleware)

    @app.get("/no-trace")
    async def no_trace():
        with tracing.start_span("child"):
            return {"trace_id": tracing.get_trace_id()}

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/no-trace")

    assert response.status_code == 200
    assert response.headers["x-request-id"] == response.json()["trace_id"]
    assert response.headers["x-trace-id"] == response.json()["trace_id"]


@pytest.mark.asyncio
async def test_stream_generation_records_usage_and_cost(monkeypatch):
    fake_langfuse = FakeLangfuse()
    monkeypatch.setattr(tracing, "_get_client", lambda: fake_langfuse)
    stream_body = (
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'
        'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4,"cost":0.002}}\n\n'
        "data: [DONE]\n\n"
    )
    provider = OpenAICompatProvider(
        base_url="https://test.local/v1",
        api_key="test-key",
        model="test-model",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                headers={"Content-Type": "text/event-stream"},
                content=stream_body.encode(),
            )
        ),
    )

    with tracing.start_trace("stream-test", trace_id="stream-trace"):
        chunks = [chunk async for chunk in provider.stream([{"role": "user", "content": "private prompt"}])]

    assert chunks == ["ok"]
    generation = fake_langfuse.records[1]
    assert generation.name == "llm.stream"
    assert generation.as_type == "generation"
    assert generation.updates[0]["usage_details"] == {"input": 3, "output": 1, "total": 4}
    assert generation.updates[0]["cost_details"] == {"total": 0.002}
    assert "private prompt" not in json.dumps(generation.input, default=str)


@pytest.mark.asyncio
async def test_agent_tool_execution_has_a_tool_span(monkeypatch, session_factory):
    fake_langfuse = FakeLangfuse()
    monkeypatch.setattr(tracing, "_get_client", lambda: fake_langfuse)
    llm = FakeAgentLLM(
        [
            json.dumps(
                {
                    "name": "search_docs",
                    "arguments": {"query": "safe result", "limit": 1},
                }
            ),
            "Found one safe source.",
        ]
    )
    graph = AgentGraph(
        llm=llm,
        vector_store=FakeVectorStore(),
        session_factory=session_factory,
    )

    with tracing.start_trace("agent.request", trace_id="agent-trace"):
        result = await graph.ainvoke(
            {
                "messages": [{"role": "user", "content": "Find a safe source."}],
                "user": {"id": "user-303", "role": UserRole.USER.value},
            },
            thread_id="trace-tool-thread",
        )

    assert result.get("status") == "completed"
    tool_span = next(record for record in fake_langfuse.records if record.name == "agent.tool")
    assert tool_span.as_type == "tool"
    assert tool_span.parent == "agent.request"
    assert tool_span.input == {"action": "search_docs"}
    assert "safe result" not in json.dumps(tool_span.updates, default=str)
