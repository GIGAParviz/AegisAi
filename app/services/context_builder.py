from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import date, datetime
from functools import lru_cache
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


def _decode_history_item(
    item: str | bytes,
) -> dict[str, str] | None:
    try:
        if isinstance(item, bytes):
            item = item.decode("utf-8")

        value = json.loads(item)
    except (
        UnicodeDecodeError,
        TypeError,
        json.JSONDecodeError,
    ):
        return None

    if not isinstance(value, dict):
        return None

    role = value.get("role")
    content = value.get("content")

    if not isinstance(role, str):
        return None

    if not isinstance(content, str):
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

    items = await redis_client.lrange(_history_key(session_id), -limit, -1)

    history: list[dict[str, str]] = []

    for item in items:
        message = _decode_history_item(item)

        if message is not None:
            history.append(message)

    return history


def _string_value(value: str) -> str:
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
    facts = [
        {
            "type": "user",
            "user_id": _string_value(user.id),
            "role": _string_value(user.role),
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

        for document in documents:
            facts.append(
                {
                    "type": "document",
                    "document_id": _string_value(document.id),
                    "filename": document.filename,
                    "mime": document.mime,
                }
            )

        return facts


@lru_cache(maxsize=1)
def _encoding() -> tiktoken.Encoding:
    return tiktoken.get_encoding("cl100k_base")


def _count_tokens(
    history: Sequence[dict[str, str]],
    sources: Sequence[SearchResult],
    facts: Sequence[dict[str, str]],
) -> int:
    parts = [
        *(message["content"] for message in history),
        *(source.text for source in sources),
        *(json.dumps(fact, ensure_ascii=False) for fact in facts),
    ]

    text = "\n".join(parts)

    return len(_encoding().encode(text))


def _trim_to_budget(
    history: list[dict[str, str]],
    sources: list[SearchResult],
    facts: list[dict[str, str]],
) -> None:
    while _count_tokens(history, sources, facts) > settings.max_context_tokens:
        if len(history) > 1:
            history.pop(0)
            continue

        if len(sources) > 1:
            sources.pop()
            continue

        if history:
            history.pop(0)
            continue

        if sources:
            sources.pop()
            continue

        if facts:
            facts.pop()
            continue

        break


def _build_sources(
    search_results: Sequence[SearchResult],
) -> list[ContextSource]:
    return [
        ContextSource(
            citation=f"[{index}]",
            document_id=result.document_id,
            chunk_index=result.chunk_index,
            text=result.text,
            heading=result.heading,
            score=result.score,
        )
        for index, result in enumerate(
            search_results,
            start=1,
        )
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
    
    if redis_client is None:
        redis_client = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
        
    try:
        store = vector_store
        
        if store is None:
            store = build_vector_store(
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
        
        facts = await _load_facts(
            factory,
            user,
        )
        
        _trim_to_budget(
            history,
            search_results,
            facts,
        )
        
        token_count = _count_tokens(
            history,
            search_results,
            facts,
        )

        return ContextPayload(
            query=query,
            history=history,
            sources=_build_sources(search_results),
            facts=facts,
            token_count=token_count,
        )

    finally:
        if owns_redis:
            await redis_client.aclose()