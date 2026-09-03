import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.engine import get_session
from app.main import app


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    session_factory = async_sessionmaker(
        engine,
        expire_on_commit=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app)

    async with AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_register_login_refresh(client):
    register_response = await client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "secret123",
        },
    )

    assert register_response.status_code == 201

    login_response = await client.post(
        "/auth/login",
        json={
            "email": "user@example.com",
            "password": "secret123",
        },
    )

    assert login_response.status_code == 200

    tokens = login_response.json()

    assert "access_token" in tokens
    assert "refresh_token" in tokens

    refresh_response = await client.post(
        "/auth/refresh",
        json={
            "refresh_token": tokens["refresh_token"],
        },
    )

    assert refresh_response.status_code == 200

    refreshed_tokens = refresh_response.json()

    assert "access_token" in refreshed_tokens
    assert "refresh_token" in refreshed_tokens


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client):
    payload = {
        "email": "duplicate@example.com",
        "password": "secret123",
    }

    first = await client.post(
        "/auth/register",
        json=payload,
    )

    assert first.status_code == 201

    second = await client.post(
        "/auth/register",
        json=payload,
    )

    assert second.status_code == 409


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    await client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "correct-password",
        },
    )

    response = await client.post(
        "/auth/login",
        json={
            "email": "user@example.com",
            "password": "wrong-password",
        },
    )

    assert response.status_code == 401
