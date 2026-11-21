import pytest
from sqlalchemy import select

from app.db.models.policy_audit import PolicyAudit
from app.db.models.user import UserRole
from tests.test_workflows import flow, identity


@pytest.mark.asyncio
async def test_resume_preserves_original_role_after_owner_promotion(client, session_factory, monkeypatch):
    user, headers = await identity(session_factory)
    body = flow("start", "approval", "tool", "end")
    body["nodes"][1]["config"] = {"message": "Review"}
    body["nodes"][2]["config"] = {"name": "search_docs", "arguments": {"query": "safe", "limit": 1}}
    import app.services.workflow_runner as runner
    from app.agents.graph import AgentGraph
    from app.services.vector_store import FakeVectorStore
    graph = AgentGraph(vector_store=FakeVectorStore())
    seen = []
    original = graph.execute_action
    async def execute(proposal, actor, session):
        seen.append(actor)
        return await original(proposal, actor, session)
    monkeypatch.setattr(graph, "execute_action", execute)
    monkeypatch.setattr(runner, "build_tool_graph", lambda: graph)
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    run = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "x"}, headers=headers)).json()
    async with session_factory() as session:
        user = await session.merge(user)
        user.role = UserRole.ADMIN
        await session.commit()
    result = await client.post(f"/workflow-runs/{run['id']}/decision", json={"decision": "approve"}, headers=headers)
    assert result.json()["status"] == "completed", result.text
    assert seen == [{"id": str(user.id), "role": "user"}]
    async with session_factory() as session:
        audits = (await session.scalars(select(PolicyAudit))).all()
        assert {a.actor_id for a in audits} == {str(user.id)}


@pytest.mark.asyncio
async def test_condition_previous_matches_before_and_after_approval(client, session_factory, monkeypatch):
    _, headers = await identity(session_factory, UserRole.ADMIN)
    body = flow("start", "condition", "approval", "llm", "end")
    body["nodes"][1]["config"] = {"contains": "yes"}
    body["nodes"][2]["config"] = {"message": "Review"}
    body["nodes"][3]["config"] = {"prompt": "{{previous}}"}
    body["edges"][1]["sourceHandle"] = "true"
    body["edges"].append({"id": "false", "source": "1", "target": "4", "sourceHandle": "false"})
    import app.services.workflow_runner as runner
    class LLM:
        async def complete(self, messages, **kwargs):
            return messages[-1]["content"]
    monkeypatch.setattr(runner, "build_llm_provider", lambda: LLM())
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    run = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "yes"}, headers=headers)).json()
    result = (await client.post(f"/workflow-runs/{run['id']}/decision", json={"decision": "approve"}, headers=headers)).json()
    assert result["output"] == "true"
    body["nodes"].pop(2)
    body["edges"] = [body["edges"][0], {"id": "true", "source": "1", "target": "3", "sourceHandle": "true"}, body["edges"][-1], body["edges"][3]]
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    result = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "yes"}, headers=headers)).json()
    assert result["output"] == "true"


@pytest.mark.asyncio
async def test_database_failure_rolls_back_before_recording_failed_run(client, session_factory, monkeypatch):
    user, headers = await identity(session_factory)
    body = flow("start", "tool", "end")
    body["nodes"][1]["config"] = {"name": "search_docs", "arguments": {"query": "safe"}}
    import app.services.workflow_runner as runner
    from app.agents.graph import AgentGraph
    from app.db.models.user import User
    from app.services.vector_store import FakeVectorStore
    graph = AgentGraph(vector_store=FakeVectorStore())

    async def fail_transaction(proposal, actor, session):
        session.add(User(email=user.email, hashed_password="unused"))
        await session.flush()  # A real uniqueness failure poisons the transaction.

    monkeypatch.setattr(graph, "execute_action", fail_transaction)
    monkeypatch.setattr(runner, "build_tool_graph", lambda: graph)
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    response = await client.post(f"/workflows/{wf['id']}/runs", json={"input": "x"}, headers=headers)
    assert response.status_code == 201, response.text
    run = response.json()
    assert run["status"] == "failed"
    assert run["error"] == "Node execution failed"
    assert [item["status"] for item in run["node_results"]] == ["completed", "failed"]
    assert (await client.get(f"/workflow-runs/{run['id']}", headers=headers)).json() == run


@pytest.mark.asyncio
async def test_expanded_prompt_is_bounded_and_failure_persisted(client, session_factory, monkeypatch):
    _, headers = await identity(session_factory)
    body = flow("start", "llm", "end")
    body["nodes"][1]["config"] = {"prompt": "{{input}}" * 10}
    import app.services.workflow_runner as runner
    calls = []
    class LLM:
        async def complete(self, messages, **kwargs):
            calls.append(messages)
            return "too late"
    monkeypatch.setattr(runner, "build_llm_provider", lambda: LLM())
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    run = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "x" * 16000}, headers=headers)).json()
    assert run["status"] == "failed"
    assert calls == []
    assert (await client.get(f"/workflow-runs/{run['id']}", headers=headers)).json() == run
