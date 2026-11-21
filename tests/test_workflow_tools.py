from dataclasses import replace

import pytest

from app.agents.graph import AgentGraph
from app.db.models.document import Document, DocumentStatus
from app.db.models.user import UserRole
from app.policies.actions import DEFAULT_ACTION_REGISTRY, ActionRegistry
from app.services.vector_store import FakeVectorStore, VectorChunk
from tests.test_workflows import flow, identity


@pytest.mark.asyncio
async def test_retrieve_condition_tool_real_execution(client, session_factory, monkeypatch):
    user, headers = await identity(session_factory)
    store = FakeVectorStore()
    async with session_factory() as session:
        doc = Document(filename="owned.txt", mime="text/plain", owner_id=user.id, status=DocumentStatus.READY)
        session.add(doc)
        await session.commit()
    await store.upsert_chunks([VectorChunk(str(doc.id), 0, "match source", [1.], owner_id=str(user.id)), VectorChunk("foreign", 0, "match private", [1.], owner_id="other")])
    import app.services.workflow_runner as runner
    monkeypatch.setattr(runner, "build_retrieval_store", lambda: store, raising=False)
    body = flow("start", "retrieve", "condition", "tool", "end")
    body["nodes"][1]["config"] = {"query": "{{input}}", "limit": 2}
    body["nodes"][2]["config"] = {"contains": "match source"}
    body["nodes"][3]["config"] = {"name": "get_document", "arguments": {"document_id": str(doc.id)}}
    body["edges"][2]["sourceHandle"] = "true"
    body["edges"].append({"id": "no", "source": "2", "target": "4", "sourceHandle": "false"})
    response = await client.post("/workflows", json=body, headers=headers)
    assert response.status_code == 201, response.text
    run = (await client.post(f"/workflows/{response.json()['id']}/runs", json={"input": "match"}, headers=headers)).json()
    assert run["status"] == "completed", run
    assert run["node_results"][1]["output"]["results"][0]["document_id"] == str(doc.id)
    assert "private" not in str(run)
    assert "owned.txt" in run["output"]
    run2 = (await client.post(f"/workflows/{response.json()['id']}/runs", json={"input": "nothing"}, headers=headers)).json()
    assert [item["node_id"] for item in run2["node_results"]] == ["0", "1", "2", "4"]


@pytest.mark.asyncio
async def test_tool_policy_approval_preserves_actor_and_verifies(client, session_factory, monkeypatch):
    user, headers = await identity(session_factory, UserRole.ADMIN)
    import app.services.workflow_runner as runner
    store = FakeVectorStore()
    registry = ActionRegistry([replace(d, requires_approval=True) for d in DEFAULT_ACTION_REGISTRY.definitions()])
    graph = AgentGraph(registry=registry, vector_store=store)
    calls = []
    original = graph.execute_action
    async def execute(proposal, actor, session):
        calls.append(actor)
        return await original(proposal, actor, session)
    monkeypatch.setattr(graph, "execute_action", execute)
    monkeypatch.setattr(runner, "build_tool_graph", lambda: graph, raising=False)
    body = flow("start", "tool", "end")
    body["nodes"][1]["config"] = {"name": "search_docs", "arguments": {"query": "{{input}}", "limit": 1}}
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    run = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "safe"}, headers=headers)).json()
    assert run["status"] == "awaiting_approval", run
    assert calls == []
    result = await client.post(f"/workflow-runs/{run['id']}/decision", json={"decision": "approve"}, headers=headers)
    assert result.json()["status"] == "completed", result.text
    assert calls == [{"id": str(user.id), "role": "admin"}]
    # Malformed tool output is rejected by AgentGraph's real verifier.
    async def invalid(*args):
        return {"wrong": "shape"}
    monkeypatch.setattr(graph, "execute_action", invalid)
    run = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "safe"}, headers=headers)).json()
    result = await client.post(f"/workflow-runs/{run['id']}/decision", json={"decision": "approve"}, headers=headers)
    assert result.json()["status"] == "failed"


@pytest.mark.asyncio
async def test_approval_cannot_bypass_changed_policy_and_denial_is_audited(client, session_factory, monkeypatch):
    from sqlalchemy import select

    from app.db.models.policy_audit import PolicyAudit, PolicyDecision
    from app.policies.gate import PolicyGate

    _, headers = await identity(session_factory, UserRole.ADMIN)
    import app.services.workflow_runner as runner
    registry = ActionRegistry([replace(d, requires_approval=True) for d in DEFAULT_ACTION_REGISTRY.definitions()])
    graph = AgentGraph(registry=registry, vector_store=FakeVectorStore())
    calls = []

    async def forbidden_execution(*args):
        calls.append(args)
        return {"results": []}

    monkeypatch.setattr(graph, "execute_action", forbidden_execution)
    monkeypatch.setattr(runner, "build_tool_graph", lambda: graph)
    body = flow("start", "tool", "end")
    body["nodes"][1]["config"] = {"name": "search_docs", "arguments": {"query": "safe"}}
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    run = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "x"}, headers=headers)).json()
    assert run["status"] == "awaiting_approval"
    graph.gate = PolicyGate(ActionRegistry([
        replace(d, constraints=(lambda proposal: False,)) for d in registry.definitions()
    ]))
    result = await client.post(f"/workflow-runs/{run['id']}/decision", json={"decision": "approve"}, headers=headers)
    assert result.json()["status"] == "failed", result.text
    assert calls == []
    async with session_factory() as session:
        denied = (await session.scalars(select(PolicyAudit).where(
            PolicyAudit.action == "search_docs", PolicyAudit.decision == PolicyDecision.DENY,
        ))).all()
        assert len(denied) == 1


@pytest.mark.asyncio
async def test_document_tool_references_are_owned(client, session_factory):
    user, _ = await identity(session_factory)
    _, other = await identity(session_factory)
    async with session_factory() as session:
        doc = Document(filename="private", mime="text/plain", owner_id=user.id)
        session.add(doc)
        await session.commit()
    body = flow("start", "tool", "end")
    body["nodes"][1]["config"] = {"name": "get_document", "arguments": {"document_id": str(doc.id)}}
    response = await client.post("/workflows", json=body, headers=other)
    assert response.status_code == 404
