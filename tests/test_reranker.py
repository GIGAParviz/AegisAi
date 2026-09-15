import pytest

from app.services.reranker import (
    FakeReranker,
)


@pytest.mark.asyncio
async def test_fake_reranker_orders_by_score():
    reranker = FakeReranker(
        scores_by_text={
            "JWT authentication": 0.4,
            "Database migration": 0.1,
            "Token expires after 30 minutes": 0.9,
        }
    )

    results = await reranker.rerank(
        query="JWT token lifetime",
        documents=[
            "JWT authentication",
            "Database migration",
            "Token expires after 30 minutes",
        ],
        top_k=2,
    )

    assert [
        item.index
        for item in results
    ] == [2, 0]
    
    
@pytest.mark.asyncio
async def test_fake_reranker_respects_top_k():
    reranker = FakeReranker(
        scores_by_text={
            "A": 0.2,
            "B": 0.8,
            "C": 0.5,
        }
    )

    results = await reranker.rerank(
        query="query",
        documents=[
            "A",
            "B",
            "C",
        ],
        top_k=1,
    )

    assert len(results) == 1
    assert results[0].index == 1
    assert results[0].score == 0.8