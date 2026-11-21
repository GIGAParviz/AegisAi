from uuid import uuid4

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings

# Make even accidentally un-overridden factories harmless; never open aegis.db.
settings.database_url = "sqlite+aiosqlite:///:memory:"

from app.db.base import Base
from app.db.engine import get_session
from app.main import app


@pytest_asyncio.fixture
async def session_factory(tmp_path, monkeypatch):
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
    )

    factory = async_sessionmaker(
        engine,
        expire_on_commit=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Workers and graph services import the factory directly, outside FastAPI DI.
    import app.agents.graph as graph_module
    import app.db.engine as engine_module
    import app.workers.tasks as worker_module
    monkeypatch.setattr(engine_module, "async_session_factory", factory)
    monkeypatch.setattr(worker_module, "async_session_factory", factory)
    monkeypatch.setattr(graph_module, "async_session_factory", factory)
    yield factory

    await engine.dispose()


@pytest_asyncio.fixture
async def client(session_factory):
    async def override_get_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    transport = ASGITransport(app=app, client=(uuid4().hex, 123))

    async with AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def db_session(session_factory):
    async with session_factory() as session:
        yield session
