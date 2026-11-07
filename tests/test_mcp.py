import json
import sys
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.agents.graph import AgentGraph
from app.agents.mcp_client import (
    McpServerConfig,
    McpToolClient,
    McpToolError,
    McpToolProposal,
    build_mcp_catalog,
)
from app.db.base import Base
from app.db.models.policy_audit import PolicyAudit, PolicyDecision
from app.db.models.user import UserRole
from app.policies.actions import ActionParseError
from app.policies.gate import PolicyGate
from tests.test_agent_graph import FakeLLMProvider, FakeVectorStore

DEMO_SERVER = Path(__file__).parent / "fixtures" / "mcp_demo_server.py"


def demo_config(
    allowed: tuple[str, ...] = ("add", "echo", "fail"),
    min_role: UserRole = UserRole.USER,
) -> McpServerConfig:
    return McpServerConfig(
        name="demo",
        command=sys.executable,
        args=(str(DEMO_SERVER),),
        allowed_tools=frozenset(allowed),
        min_role=min_role,
    )


@pytest_asyncio.fixture
async def audit_session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield session_factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_discovery_returns_only_allowlisted_tools():
    async with McpToolClient(demo_config(allowed=("add",))) as client:
        tools = await client.discover_tools()

    assert [tool.name for tool in tools] == ["add"]


@pytest.mark.asyncio
async def test_call_tool_returns_text_and_structured_content():
    async with McpToolClient(demo_config()) as client:
        result = await client.call_tool("add", {"a": 2, "b": 3})

    assert result["text"] == "5"
    assert result["structured"] == {"result": 5}


@pytest.mark.asyncio
async def test_call_tool_raises_when_server_reports_error():
    async with McpToolClient(demo_config()) as client:
        with pytest.raises(McpToolError, match="Error executing tool fail"):
            await client.call_tool("fail", {"reason": "boom"})


@pytest.mark.asyncio
async def test_call_tool_rejects_non_allowlisted_tool():
    async with McpToolClient(demo_config(allowed=("add",))) as client:
        with pytest.raises(McpToolError, match="not allowlisted"):
            await client.call_tool("echo", {"text": "hi"})


@pytest.mark.asyncio
async def test_catalog_registers_mcp_tools_and_executes_them():
    async with McpToolClient(demo_config(allowed=("add",))) as client:
        catalog = await build_mcp_catalog([client])
        registry = catalog.registry()

        proposal = registry.parse_proposal(
            json.dumps(
                {
                    "name": "mcp.demo.add",
                    "arguments": {"a": 10, "b": 4},
                }
            )
        )

        assert isinstance(proposal, McpToolProposal)

        result = await catalog.execute(proposal)

    assert result["text"] == "14"


@pytest.mark.asyncio
async def test_registry_rejects_unregistered_mcp_tool():
    async with McpToolClient(demo_config(allowed=("add",))) as client:
        catalog = await build_mcp_catalog([client])
        registry = catalog.registry()

        with pytest.raises(ActionParseError, match="Unknown action"):
            registry.parse_proposal(
                json.dumps(
                    {
                        "name": "mcp.demo.echo",
                        "arguments": {"text": "hi"},
                    }
                )
            )


@pytest.mark.asyncio
async def test_gate_denies_schema_violation_and_audits(audit_session_factory):
    async with McpToolClient(demo_config(allowed=("add",))) as client:
        catalog = await build_mcp_catalog([client])
        gate = PolicyGate(catalog.registry())
        proposal = catalog.registry().parse_proposal(
            json.dumps(
                {
                    "name": "mcp.demo.add",
                    "arguments": {"a": 1},
                }
            )
        )

        async with audit_session_factory() as session:
            decision = await gate.check(
                proposal,
                {"id": "user-1", "role": UserRole.USER.value},
                session,
            )
            await session.commit()

        assert decision.allowed is False
        assert decision.decision == PolicyDecision.DENY
        assert "Constraint violation" in decision.reason

    async with audit_session_factory() as session:
        result = await session.execute(
            select(PolicyAudit).where(PolicyAudit.id == decision.audit_id)
        )
        audit = result.scalar_one()

    assert audit.action == "mcp.demo.add"
    assert audit.decision == PolicyDecision.DENY


@pytest.mark.asyncio
async def test_gate_allows_permitted_mcp_call(audit_session_factory):
    async with McpToolClient(demo_config(allowed=("add",))) as client:
        catalog = await build_mcp_catalog([client])
        gate = PolicyGate(catalog.registry())
        proposal = catalog.registry().parse_proposal(
            json.dumps(
                {
                    "name": "mcp.demo.add",
                    "arguments": {"a": 7, "b": 8},
                }
            )
        )

        async with audit_session_factory() as session:
            decision = await gate.check(
                proposal,
                {"id": "user-2", "role": UserRole.USER.value},
                session,
            )
            await session.commit()

        assert decision.allowed is True
        result = await catalog.execute(proposal)

    assert result["text"] == "15"


@pytest.mark.asyncio
async def test_gate_denies_mcp_call_for_insufficient_role(audit_session_factory):
    async with McpToolClient(
        demo_config(allowed=("add",), min_role=UserRole.ADMIN)
    ) as client:
        catalog = await build_mcp_catalog([client])
        gate = PolicyGate(catalog.registry())
        proposal = catalog.registry().parse_proposal(
            json.dumps(
                {
                    "name": "mcp.demo.add",
                    "arguments": {"a": 1, "b": 2},
                }
            )
        )

        async with audit_session_factory() as session:
            decision = await gate.check(
                proposal,
                {"id": "user-3", "role": UserRole.USER.value},
                session,
            )
            await session.commit()

    assert decision.allowed is False
    assert "Insufficient role" in decision.reason


@pytest.mark.asyncio
async def test_agent_graph_runs_mcp_tool_end_to_end(audit_session_factory):
    tool_call = json.dumps(
        {
            "name": "mcp.demo.echo",
            "arguments": {"text": "AegisAI"},
        }
    )
    final_answer = "The echoed text is AegisAI."

    async with McpToolClient(demo_config(allowed=("echo",))) as client:
        catalog = await build_mcp_catalog([client])
        graph = AgentGraph(
            llm=FakeLLMProvider([tool_call, final_answer]),
            mcp_catalog=catalog,
            vector_store=FakeVectorStore(),
            session_factory=audit_session_factory,
        )

        result = await graph.ainvoke(
            {
                "messages": [{"role": "user", "content": "Echo AegisAI"}],
                "user": {"id": "user-4", "role": UserRole.USER.value},
            },
            thread_id="mcp-thread-1",
        )

    assert result["status"] == "completed"
    assert result["decision"].allowed is True
    assert result["action_result"]["text"] == "AegisAI"
    assert result["final_response"] == final_answer


@pytest.mark.asyncio
async def test_agent_graph_reports_mcp_tool_failure(audit_session_factory):
    tool_call = json.dumps(
        {
            "name": "mcp.demo.fail",
            "arguments": {"reason": "disk unavailable"},
        }
    )

    async with McpToolClient(demo_config(allowed=("fail",))) as client:
        catalog = await build_mcp_catalog([client])
        graph = AgentGraph(
            llm=FakeLLMProvider([tool_call]),
            mcp_catalog=catalog,
            vector_store=FakeVectorStore(),
            session_factory=audit_session_factory,
        )

        result = await graph.ainvoke(
            {
                "messages": [{"role": "user", "content": "Run failing tool"}],
                "user": {"id": "user-5", "role": UserRole.USER.value},
            },
            thread_id="mcp-thread-2",
        )

    assert result["status"] == "error"
    assert "Error executing tool fail" in result["verification_errors"][0]
