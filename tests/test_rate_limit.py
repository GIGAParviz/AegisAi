import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.middleware.rate_limit import RateLimitMiddleware


@pytest_asyncio.fixture
async def rate_limit_client():
    fake_redis = FakeAsyncRedis(
        decode_responses=True,
    )

    test_app = FastAPI()

    test_app.add_middleware(
        RateLimitMiddleware,
        redis_client=fake_redis,
        limit=2,
        window_seconds=60,
    )

    @test_app.get("/ping")
    async def ping():
        return {"message": "pong"}

    transport = ASGITransport(
        app=test_app,
    )

    async with AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as client:
        yield client

    await fake_redis.aclose()
    
    
@pytest.mark.asyncio
async def test_rate_limit_returns_429(
    rate_limit_client,
):
    first = await rate_limit_client.get("/ping")
    second = await rate_limit_client.get("/ping")
    third = await rate_limit_client.get("/ping")

    assert first.status_code == 200
    assert second.status_code == 200

    assert third.status_code == 429

    assert "Retry-After" in third.headers
    
    
@pytest.mark.asyncio
async def test_memory_fallback_rate_limit():
    test_app = FastAPI()

    test_app.add_middleware(
        RateLimitMiddleware,
        redis_client=None,
        limit=2,
        window_seconds=60,
    )

    @test_app.get("/ping")
    async def ping():
        return {"message": "pong"}

    transport = ASGITransport(
        app=test_app,
    )

    async with AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as client:
        first = await client.get("/ping")
        second = await client.get("/ping")
        third = await client.get("/ping")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429