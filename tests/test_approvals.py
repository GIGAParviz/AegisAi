import json

import pytest
from sqlalchemy import select

from app.agents.graph import AgentGraph
from app.api.approvals import get_agent_graph
from app.core.security import hash_pass
from app.db.models.approval import Approval, ApprovalStatus
from app.db.models.policy_audit import PolicyAudit, PolicyDecision
from app.db.models.user import User, UserRole
from app.main import app
from app.policies.actions import (
    ActionDefinition,
    ActionRegistry,
    SearchDocsProposal,
)
from tests.test_agent_graph import FakeLLMProvider, FakeVectorStore

TOOL_CALL = json.dumps(
    {
        "name": "search_docs",
        "arguments": {
            "query": "authentication",
            "limit": 3,
        },
    }
)


def approval_registry() -> ActionRegistry:
    return ActionRegistry(
        [
            ActionDefinition(
                name="search_docs",
                proposal_model=SearchDocsProposal,
                min_role=UserRole.USER,
                requires_approval=True,
            )
        ]
    )


async def create_user(db_session, email: str, role: UserRole) -> User:
    user = User(
        email=email,
        hashed_password=hash_pass("secret123"),
        role=role,
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def login_headers(client, email: str) -> dict[str, str]:
    response = await client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "secret123",
        },
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def start_pending_run(
    session_factory,
    thread_id: str,
    user: User,
    responses: list[str],
    vector_store: FakeVectorStore,
) -> AgentGraph:
    graph = AgentGraph(
        llm=FakeLLMProvider(responses),
        registry=approval_registry(),
        vector_store=vector_store,
        session_factory=session_factory,
    )
    app.dependency_overrides[get_agent_graph] = lambda: graph

    result = await graph.ainvoke(
        {
            "messages": [
                {"role": "user", "content": "How do we handle authentication?"}
            ],
            "user": {"id": str(user.id), "role": user.role.value},
        },
        thread_id=thread_id,
    )
    assert "__interrupt__" in result
    return graph


async def fetch_approval(db_session, thread_id: str) -> Approval:
    result = await db_session.execute(
        select(Approval).where(Approval.graph_run_id == thread_id)
    )
    return result.scalar_one()


@pytest.mark.asyncio
async def test_gate_interrupts_and_records_pending_approval(
    db_session,
    session_factory,
):
    user = await create_user(db_session, "requester@example.com", UserRole.USER)
    vector_store = FakeVectorStore()

    await start_pending_run(
        session_factory,
        "approval-thread-1",
        user,
        [TOOL_CALL],
        vector_store,
    )

    approval = await fetch_approval(db_session, "approval-thread-1")
    assert approval.status == ApprovalStatus.PENDING
    assert approval.action == "search_docs"
    assert vector_store.last_query == ""

    audit_result = await db_session.execute(
        select(PolicyAudit).where(PolicyAudit.action == "search_docs")
    )
    audits = audit_result.scalars().all()
    assert [audit.decision for audit in audits] == [PolicyDecision.PENDING_APPROVAL]


@pytest.mark.asyncio
async def test_approval_resumes_graph_and_executes_action(
    client,
    db_session,
    session_factory,
):
    requester = await create_user(db_session, "requester-a@example.com", UserRole.USER)
    await create_user(db_session, "admin-a@example.com", UserRole.ADMIN)
    admin_headers = await login_headers(client, "admin-a@example.com")
    vector_store = FakeVectorStore()
    final_answer = "JWT HS256 tokens are used for authentication."

    await start_pending_run(
        session_factory,
        "approval-thread-2",
        requester,
        [TOOL_CALL, final_answer],
        vector_store,
    )
    approval = await fetch_approval(db_session, "approval-thread-2")

    response = await client.post(
        f"/approvals/{approval.id}/decision",
        json={"decision": "approve"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["approval"]["status"] == "approved"
    assert body["final_response"] == final_answer
    assert vector_store.last_query == "authentication"

    audit_result = await db_session.execute(
        select(PolicyAudit).where(PolicyAudit.decision == PolicyDecision.ALLOW)
    )
    assert audit_result.scalars().first() is not None


@pytest.mark.asyncio
async def test_rejection_responds_without_executing_action(
    client,
    db_session,
    session_factory,
):
    requester = await create_user(db_session, "requester-b@example.com", UserRole.USER)
    await create_user(db_session, "admin-b@example.com", UserRole.ADMIN)
    admin_headers = await login_headers(client, "admin-b@example.com")
    vector_store = FakeVectorStore()

    await start_pending_run(
        session_factory,
        "approval-thread-3",
        requester,
        [TOOL_CALL],
        vector_store,
    )
    approval = await fetch_approval(db_session, "approval-thread-3")

    response = await client.post(
        f"/approvals/{approval.id}/decision",
        json={"decision": "reject"},
        headers=admin_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["approval"]["status"] == "rejected"
    assert body["final_response"] == "Action was rejected by a human reviewer."
    assert vector_store.last_query == ""


@pytest.mark.asyncio
async def test_non_admin_cannot_decide_approval(
    client,
    db_session,
    session_factory,
):
    requester = await create_user(db_session, "requester-c@example.com", UserRole.USER)
    await create_user(db_session, "plain-c@example.com", UserRole.USER)
    plain_headers = await login_headers(client, "plain-c@example.com")

    await start_pending_run(
        session_factory,
        "approval-thread-4",
        requester,
        [TOOL_CALL],
        FakeVectorStore(),
    )
    approval = await fetch_approval(db_session, "approval-thread-4")

    response = await client.post(
        f"/approvals/{approval.id}/decision",
        json={"decision": "approve"},
        headers=plain_headers,
    )

    assert response.status_code == 403
    await db_session.refresh(approval)
    assert approval.status == ApprovalStatus.PENDING


@pytest.mark.asyncio
async def test_approval_cannot_be_decided_twice(
    client,
    db_session,
    session_factory,
):
    requester = await create_user(db_session, "requester-d@example.com", UserRole.USER)
    await create_user(db_session, "admin-d@example.com", UserRole.ADMIN)
    admin_headers = await login_headers(client, "admin-d@example.com")

    await start_pending_run(
        session_factory,
        "approval-thread-5",
        requester,
        [TOOL_CALL],
        FakeVectorStore(),
    )
    approval = await fetch_approval(db_session, "approval-thread-5")

    first = await client.post(
        f"/approvals/{approval.id}/decision",
        json={"decision": "reject"},
        headers=admin_headers,
    )
    second = await client.post(
        f"/approvals/{approval.id}/decision",
        json={"decision": "approve"},
        headers=admin_headers,
    )

    assert first.status_code == 200
    assert second.status_code == 409
