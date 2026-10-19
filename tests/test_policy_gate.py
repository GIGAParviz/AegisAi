from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models.policy_audit import PolicyAudit, PolicyDecision
from app.db.models.user import UserRole
from app.policies.actions import (
    DEFAULT_ACTION_REGISTRY,
    ActionDefinition,
    ActionRegistry,
    SearchDocsArguments,
    SearchDocsProposal,
)
from app.policies.gate import PolicyGate


@pytest_asyncio.fixture
async def gate_db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_unknown_action_is_denied_and_audited(gate_db_session):
    gate = PolicyGate(DEFAULT_ACTION_REGISTRY)
    user = SimpleNamespace(id="user-123", role=UserRole.USER)

    bad_proposal = {"name": "drop_all_tables", "arguments": {}}

    decision = await gate.check(bad_proposal, user, gate_db_session)

    assert decision.allowed is False
    assert decision.decision == PolicyDecision.DENY
    assert "Unknown action" in decision.reason

    result = await gate_db_session.execute(
        select(PolicyAudit).where(PolicyAudit.id == decision.audit_id)
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.action == "drop_all_tables"
    assert audit.decision == PolicyDecision.DENY
    assert audit.actor_id == "user-123"


@pytest.mark.asyncio
async def test_insufficient_role_is_denied_and_audited(gate_db_session):
    admin_registry = ActionRegistry(
        [
            ActionDefinition(
                name="search_docs",
                proposal_model=SearchDocsProposal,
                min_role=UserRole.ADMIN,
            )
        ]
    )
    gate = PolicyGate(admin_registry)

    regular_user = SimpleNamespace(id="user-456", role=UserRole.USER)
    proposal = SearchDocsProposal(
        name="search_docs", arguments=SearchDocsArguments(query="secret docs", limit=5)
    )

    decision = await gate.check(proposal, regular_user, gate_db_session)

    assert decision.allowed is False
    assert decision.decision == PolicyDecision.DENY
    assert "Insufficient role" in decision.reason

    result = await gate_db_session.execute(
        select(PolicyAudit).where(PolicyAudit.id == decision.audit_id)
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.decision == PolicyDecision.DENY


@pytest.mark.asyncio
async def test_allowed_action_is_permitted_and_audited(gate_db_session):
    gate = PolicyGate(DEFAULT_ACTION_REGISTRY)
    user = SimpleNamespace(id="user-789", role=UserRole.USER)

    proposal = SearchDocsProposal(
        name="search_docs",
        arguments=SearchDocsArguments(query="FastAPI guide", limit=3),
    )

    decision = await gate.check(proposal, user, gate_db_session)

    assert decision.allowed is True
    assert decision.decision == PolicyDecision.ALLOW
    assert "permitted" in decision.reason.lower()

    result = await gate_db_session.execute(
        select(PolicyAudit).where(PolicyAudit.id == decision.audit_id)
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.decision == PolicyDecision.ALLOW
    assert audit.action == "search_docs"


@pytest.mark.asyncio
async def test_constraint_violation_is_denied_and_audited(gate_db_session):
    max_limit_constraint = lambda p: p.arguments.limit <= 3

    constrained_registry = ActionRegistry(
        [
            ActionDefinition(
                name="search_docs",
                proposal_model=SearchDocsProposal,
                min_role=UserRole.USER,
                constraints=(max_limit_constraint,),
            )
        ]
    )
    gate = PolicyGate(constrained_registry)
    user = SimpleNamespace(id="user-101", role=UserRole.USER)

    proposal = SearchDocsProposal(
        name="search_docs", arguments=SearchDocsArguments(query="test", limit=5)
    )

    decision = await gate.check(proposal, user, gate_db_session)

    assert decision.allowed is False
    assert decision.decision == PolicyDecision.DENY
    assert "Constraint violation" in decision.reason

    result = await gate_db_session.execute(
        select(PolicyAudit).where(PolicyAudit.id == decision.audit_id)
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.decision == PolicyDecision.DENY
