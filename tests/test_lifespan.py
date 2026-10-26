from contextlib import asynccontextmanager

import pytest

import app.main as main_module
from app.core.config import settings


@pytest.mark.asyncio
async def test_development_lifespan_disables_agent_graph(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")

    async with main_module.lifespan(main_module.app):
        assert main_module.app.state.agent_graph is None


@pytest.mark.asyncio
async def test_production_lifespan_starts_agent_graph(monkeypatch):
    marker = object()

    @asynccontextmanager
    async def fake_postgres_agent_graph():
        yield marker

    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(
        main_module,
        "postgres_agent_graph",
        fake_postgres_agent_graph,
    )

    async with main_module.lifespan(main_module.app):
        assert main_module.app.state.agent_graph is marker