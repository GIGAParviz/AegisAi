import json
from types import SimpleNamespace

import pytest
from fakeredis.aioredis import FakeRedis

from app.core.config import settings
from app.services.context_builder import build
from app.services.vector_store import SearchResult


class FakeVectorStore:
    async def hybrid_search(
        self,
        query: str,
        k: int = 5,
    ) -> list[SearchResult]:
        results = [
            SearchResult(
                document_id="doc-1",
                chunk_index=0,
                text="first source",
                heading="First",
                score=0.9,
            ),
            SearchResult(
                document_id="doc-2",
                chunk_index=1,
                text="second source",
                heading="Second",
                score=0.8,
            ),
        ]

        return results[:k]


class FakeResult:
    def scalars(self):
        return self

    def all(self):
        return []


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def execute(self, statement):
        return FakeResult()


class FakeSessionFactory:
    def __call__(self):
        return FakeSession()


@pytest.mark.asyncio
async def test_build_orders_context_sections(
    monkeypatch,
):
    redis = FakeRedis(
        decode_responses=True
    )

    await redis.rpush(
        "chat:history:session-1",
        json.dumps(
            {
                "role": "user",
                "content": "old",
            }
        ),
        json.dumps(
            {
                "role": "assistant",
                "content": "new",
            }
        ),
    )

    user = SimpleNamespace(
        id="user-1",
        role="user",
    )

    monkeypatch.setattr(
        settings,
        "max_context_tokens",
        2048,
    )

    payload = await build(
        query="query",
        session_id="session-1",
        user=user,
        redis_client=redis,
        vector_store=FakeVectorStore(),
        session_factory=FakeSessionFactory(),
    )

    assert [
        message["content"]
        for message in payload.history
    ] == [
        "old",
        "new",
    ]

    assert [
        source.citation
        for source in payload.sources
    ] == [
        "[1]",
        "[2]",
    ]

    assert payload.sources[0].text == "first source"
    assert payload.facts[0]["type"] == "user"

    await redis.aclose()


@pytest.mark.asyncio
async def test_build_trims_old_history_and_low_rank_source(
    monkeypatch,
):
    redis = FakeRedis(
        decode_responses=True
    )

    await redis.rpush(
        "chat:history:session-2",
        json.dumps(
            {
                "role": "user",
                "content": "old history words",
            }
        ),
        json.dumps(
            {
                "role": "assistant",
                "content": "new history words",
            }
        ),
    )

    user = SimpleNamespace(
        id="u",
        role="user",
    )

    monkeypatch.setattr(
        settings,
        "max_context_tokens",
        28,
    )

    payload = await build(
        query="query",
        session_id="session-2",
        user=user,
        redis_client=redis,
        vector_store=FakeVectorStore(),
        session_factory=FakeSessionFactory(),
    )

    assert payload.history == [
        {
            "role": "assistant",
            "content": "new history words",
        }
    ]

    assert [
        source.citation
        for source in payload.sources
    ] == ["[1]"]

    assert payload.token_count <= settings.max_context_tokens

    await redis.aclose()