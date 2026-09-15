import os

import pytest

from app.services.vector_store import (
    FakeVectorStore,
    VectorChunk,
)

RUN_QDRANT = os.getenv("RUN_QDRANT_INTEGRATION") == "1"

@pytest.mark.asyncio
async def test_fake_vector_store_upsert():
    store = FakeVectorStore()

    await store.ensure_collection()

    chunks = [
        VectorChunk(
            document_id="doc-1",
            chunk_index=0,
            text="JWT authentication",
            dense_vector=[0.1, 0.2],
            heading="Authentication",
        )
    ]

    await store.upsert_chunks(chunks)

    assert store.collection_ready is True
    assert len(store.chunks) == 1

    assert store.chunks[0].text == "JWT authentication"


@pytest.mark.asyncio
async def test_fake_vector_store_search():
    store = FakeVectorStore()

    await store.upsert_chunks(
        [
            VectorChunk(
                document_id="doc-1",
                chunk_index=0,
                text="JWT authentication",
                dense_vector=[0.1, 0.2],
                heading="Authentication",
            ),
            VectorChunk(
                document_id="doc-1",
                chunk_index=1,
                text="PostgreSQL database",
                dense_vector=[0.2, 0.1],
                heading="Database",
            ),
        ]
    )

    results = await store.hybrid_search(
        "JWT",
        k=5,
    )

    assert len(results) == 1

    assert results[0].heading == "Authentication"

    assert results[0].chunk_index == 0
