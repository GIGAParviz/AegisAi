import asyncio

import pytest

from app.db.models.user import UserRole
from tests.test_workflows import flow, identity


@pytest.mark.asyncio
async def test_approval_resume_snapshot_and_duplicate_decisions(client, session_factory, monkeypatch):
    _, headers = await identity(session_factory, UserRole.ADMIN)
    _, stranger = await identity(session_factory, UserRole.ADMIN)
    _, normal = await identity(session_factory)
    body = flow("start", "approval", "llm", "end")
    body["nodes"][1]["config"] = {"message": "Continue?"}
    body["nodes"][2]["config"] = {"prompt": "Original {{previous}}"}
    response = await client.post("/workflows", json=body, headers=headers)
    workflow_id = response.json()["id"]
    import app.services.workflow_runner as runner
    calls = []
    class LLM:
        async def complete(self, messages, **kwargs):
            calls.append(messages)
            await asyncio.sleep(0.05)
            return "Approved answer"
    monkeypatch.setattr(runner, "build_llm_provider", lambda: LLM())
    response = await client.post(f"/workflows/{workflow_id}/runs", json={"input": "hello"}, headers=headers)
    run = response.json()
    assert run["status"] == "awaiting_approval", response.text
    assert run["pending_node_id"] == "1"
    assert calls == []
    path = f"/workflow-runs/{run['id']}/decision"
    assert (await client.post(path, json={"decision": "approve"}, headers=normal)).status_code == 403
    assert (await client.post(path, json={"decision": "approve"}, headers=stranger)).status_code == 404
    body["nodes"][2]["config"]["prompt"] = "EDITED"
    assert (await client.put(f"/workflows/{workflow_id}", json=body, headers=headers)).status_code == 200
    responses = await asyncio.gather(*(client.post(path, json={"decision": "approve"}, headers=headers) for _ in range(2)))
    assert sorted(r.status_code for r in responses) == [200, 409]
    completed = next(r.json() for r in responses if r.status_code == 200)
    assert completed["status"] == "completed"
    assert completed["pending_node_id"] is None
    assert len(calls) == 1
    assert calls[0][-1]["content"] == "Original hello"
    assert [n["node_id"] for n in completed["node_results"]] == ["0", "1", "2", "3"]
    assert (await client.get(f"/workflow-runs/{run['id']}", headers=headers)).json() == completed


@pytest.mark.asyncio
async def test_stale_decision_cannot_claim_a_later_approval(client, session_factory, monkeypatch):
    _, headers = await identity(session_factory, UserRole.ADMIN)
    body = flow("start", "approval", "approval", "end")
    for node in body["nodes"][1:3]:
        node["config"] = {"message": "Review this step"}
    workflow = (await client.post("/workflows", json=body, headers=headers)).json()
    run = (await client.post(f"/workflows/{workflow['id']}/runs", json={"input": "x"}, headers=headers)).json()
    import app.api.workflows as api
    from app.db.models.workflow import WorkflowRun
    original_owned = api.owned
    second_read, release_second = asyncio.Event(), asyncio.Event()
    reads = 0

    async def delayed_owned(session, model, identifier, user):
        nonlocal reads
        result = await original_owned(session, model, identifier, user)
        if model is WorkflowRun:
            reads += 1
            if reads == 1:
                await second_read.wait()
            elif reads == 2:
                second_read.set()
                await release_second.wait()
        return result

    monkeypatch.setattr(api, "owned", delayed_owned)
    path = f"/workflow-runs/{run['id']}/decision"
    first = asyncio.create_task(client.post(path, json={"decision": "approve"}, headers=headers))
    second = asyncio.create_task(client.post(path, json={"decision": "approve"}, headers=headers))
    try:
        result = await asyncio.wait_for(first, timeout=5)
        assert result.json()["pending_node_id"] == "2"
    finally:
        release_second.set()
    stale = await asyncio.wait_for(second, timeout=5)
    assert stale.status_code == 409, stale.text
    persisted = (await client.get(f"/workflow-runs/{run['id']}", headers=headers)).json()
    assert persisted["pending_node_id"] == "2"
    assert persisted["status"] == "awaiting_approval"


@pytest.mark.asyncio
async def test_approval_reject_stops_run(client, session_factory):
    _, headers = await identity(session_factory, UserRole.ADMIN)
    body = flow("start", "approval", "end")
    body["nodes"][1]["config"] = {"message": "Continue?"}
    workflow = (await client.post("/workflows", json=body, headers=headers)).json()
    run = (await client.post(f"/workflows/{workflow['id']}/runs", json={"input": "x"}, headers=headers)).json()
    result = await client.post(f"/workflow-runs/{run['id']}/decision", json={"decision": "reject"}, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "rejected"
    assert result.json()["node_results"][-1]["status"] == "rejected"


@pytest.mark.asyncio
async def test_agent_approval_and_snapshot(client, session_factory, monkeypatch):
    _, headers = await identity(session_factory, UserRole.ADMIN)
    _, other = await identity(session_factory)
    agent = (await client.post("/agents", headers=headers, json={"name": "Guarded", "system_prompt": "Original system", "requires_approval": True})).json()
    body = flow("start", "llm", "end")
    body["nodes"][1]["config"] = {"prompt": "{{input}}", "agent_id": agent["id"]}
    assert (await client.post("/workflows", json=body, headers=other)).status_code == 404
    wf = (await client.post("/workflows", json=body, headers=headers)).json()
    import app.services.workflow_runner as runner
    calls = []
    class LLM:
        async def complete(self, messages, **kwargs):
            calls.append(messages)
            return "safe"
    monkeypatch.setattr(runner, "build_llm_provider", lambda: LLM())
    run = (await client.post(f"/workflows/{wf['id']}/runs", json={"input": "hello"}, headers=headers)).json()
    assert run["status"] == "awaiting_approval"
    assert calls == []
    await client.delete(f"/agents/{agent['id']}", headers=headers)
    result = await client.post(f"/workflow-runs/{run['id']}/decision", json={"decision": "approve"}, headers=headers)
    assert result.json()["status"] == "completed", result.text
    assert calls[0][0] == {"role": "system", "content": "Original system"}
