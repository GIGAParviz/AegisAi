from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any
from uuid import UUID

import tiktoken
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.db.engine import async_session_factory
from app.db.models.document import Document, DocumentStatus
from app.db.models.user import User
from app.services.embeddings import build_embedding_provider
from app.services.vector_store import (
    SearchResult,
    VectorStore,
    build_vector_store,
)


class ContextSource(BaseModel):
    citation: str
    document_id: str
    chunk_index: int
    text: str
    heading: str | None = None
    score: float


class ContextPayload(BaseModel):
    query: str
    history: list[dict[str, str]] = Field(default_factory=list)
    sources: list[ContextSource] = Field(default_factory=list)
    facts: list[dict[str, str]] = Field(default_factory=list)
    token_count: int = 0


def _history_key(session_id: str) -> str:
    return f"chat:history:{session_id}"


def _decode_history_item(item: str | bytes) -> dict[str, str] | None:
    if isinstance(item, bytes):
        item = item.decode("utf-8")

    try:
        value = json.loads(item)
    except (TypeError, json.JSONDecodeError):
        return None

    if not isinstance(value, dict):
        return None

    role = value.get("role")
    content = value.get("content")

    if not isinstance(role, str) or not isinstance(content, str):
        return None

    return {
        "role": role,
        "content": content,
    }


async def _load_history(
    redis_client: Redis,
    session_id: str,
) -> list[dict[str, str]]:
    limit = settings.context_history_limit

    if limit <= 0:
        return []

    items = await redis_client.lrange(
        _history_key(session_id),
        -limit,
        -1,
    )

    return [
        message
        for item in items
        if (message := _decode_history_item(item)) is not None
    ]


def _string_value(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, UUID):
        return str(value)

    enum_value = getattr(value, "value", None)
    if enum_value is not None:
        return str(enum_value)

    return str(value)


async def _load_facts(
    session_factory: async_sessionmaker[AsyncSession],
    user: User,
) -> list[dict[str, str]]:
    user_id = _string_value(user.id)
    role = _string_value(user.role)

    facts = [
        {
            "type": "user",
            "user_id": user_id,
            "role": role,
        }
    ]

    async with session_factory() as session:
        result = await session.execute(
            select(Document)
            .where(
                Document.owner_id == user.id,
                Document.status == DocumentStatus.READY,
            )
            .order_by(Document.created_at.desc())
        )

        documents = result.scalars().all()

    facts.extend(
        {
            "type": "document",
            "document_id": _string_value(document.id),
            "filename": document.filename,
            "mime": document.mime,
        }
        for document in documents
    )

    return facts


def _encoding() -> tiktoken.Encoding:
    return tiktoken.get_encoding("cl100k_base")


def _count_tokens(
    history: Sequence[dict[str, str]],
    sources: Sequence[SearchResult],
    facts: Sequence[dict[str, str]],
) -> int:
    text_parts = [
        *(message["content"] for message in history),
        *(source.text for source in sources),
        *(json.dumps(fact, ensure_ascii=False) for fact in facts),
    ]

    return len(_encoding().encode("\n".join(text_parts)))


def _source_payloads(
    sources: Sequence[SearchResult],
) -> list[ContextSource]:
    return [
        ContextSource(
            citation=f"[{index}]",
            document_id=source.document_id,
            chunk_index=source.chunk_index,
            text=source.text,
            heading=source.heading,
            score=source.score,
        )
        for index, source in enumerate(sources, start=1)
    ]


async def build(
    query: str,
    session_id: str,
    user: User,
    *,
    redis_client: Redis | None = None,
    vector_store: VectorStore | None = None,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
) -> ContextPayload:
    owns_redis = redis_client is None
    redis_client = redis_client or Redis.from_url(
        settings.redis_url,
        decode_responses=True,
    )

    try:
        store = vector_store or build_vector_store(
            build_embedding_provider()
        )
        factory = session_factory or async_session_factory

        history = await _load_history(
            redis_client,
            session_id,
        )
        search_results = await store.hybrid_search(
            query,
            k=settings.context_sources_limit,
        )
        facts = await _load_facts(factory, user)

        while (
            _count_tokens(history, search_results, facts)
            > settings.max_context_tokens
        ):
            if len(history) > 1:
                history.pop(0)
            elif len(search_results) > 1:
                search_results.pop()
            elif history:
                history.pop(0)
            elif search_results:
                search_results.pop()
            elif facts:
                facts.pop()
            else:
                break

        token_count = _count_tokens(
            history,
            search_results,
            facts,
        )

        return ContextPayload(
            query=query,
            history=history,
            sources=_source_payloads(search_results),
            facts=facts,
            token_count=token_count,
        )
    finally:
        if owns_redis:
            await redis_client.aclose()
