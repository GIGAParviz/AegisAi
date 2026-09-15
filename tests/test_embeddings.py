import pytest

from app.core.config import settings
from app.services.embeddings import (
    FakeEmbeddingProvider,
    build_embedding_provider,
)


def test_default_provider_is_fake(monkeypatch):
    monkeypatch.setattr(settings, "embedding_provider", "fake")

    assert isinstance(build_embedding_provider(), FakeEmbeddingProvider)


@pytest.mark.asyncio
async def test_fake_embedding_dimensions():
    provider = FakeEmbeddingProvider(
        dimensions=8,
    )

    vectors = await provider.embed(
        [
            "hello",
            "world",
        ]
    )

    assert len(vectors) == 2

    assert all(
        len(vector) == 8
        for vector in vectors
    )


@pytest.mark.asyncio
async def test_fake_embedding_is_deterministic():
    provider = FakeEmbeddingProvider(
        dimensions=8,
    )

    first = await provider.embed(
        ["AegisAI"]
    )

    second = await provider.embed(
        ["AegisAI"]
    )

    assert first == second


@pytest.mark.asyncio
async def test_different_texts_produce_different_vectors():
    provider = FakeEmbeddingProvider(
        dimensions=8,
    )

    vectors = await provider.embed(
        [
            "AegisAI",
            "Celery",
        ]
    )

    assert vectors[0] != vectors[1]


@pytest.mark.asyncio
async def test_empty_input_returns_empty_list():
    provider = FakeEmbeddingProvider(
        dimensions=8,
    )

    vectors = await provider.embed([])

    assert vectors == []
