import pytest

from app.core.security import create_access_token
from app.db.models.user import User, UserRole


async def identity(session_factory, role=UserRole.USER):
    from uuid import uuid4
    async with session_factory() as session:
        user = User(email=f"{uuid4()}@example.com", hashed_password="unused", role=role)
        session.add(user)
        await session.commit()
        return user, {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def flow(*types):
    nodes = [{"id": str(i), "type": kind, "position": {"x": i, "y": 0}, "config": {}}
             for i, kind in enumerate(types)]
    return {"name": "Test", "description": "", "nodes": nodes,
            "edges": [{"id": str(i), "source": str(i), "target": str(i+1)}
                      for i in range(len(nodes)-1)]}


@pytest.mark.asyncio
async def test_agent_crud_is_owner_scoped(client, session_factory):
    _, headers = await identity(session_factory)
    _, other = await identity(session_factory)
    payload = {"name": "Writer", "system_prompt": "Be accurate", "model": "", "allowed_tools": ["search_docs"], "requires_approval": True}
    assert (await client.post("/agents", json=payload)).status_code in (401, 403)
    response = await client.post("/agents", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    agent = response.json()
    assert agent["requires_approval"] is True
    assert "created_at" in agent
    assert (await client.get("/agents", headers=headers)).json() == [agent]
    assert (await client.get("/agents", headers=other)).json() == []
    for method in ("get", "put", "delete"):
        kwargs = {"json": payload} if method == "put" else {}
        assert (await getattr(client, method)(f"/agents/{agent['id']}", headers=other, **kwargs)).status_code == 404
    payload["name"] = "Editor"
    assert (await client.put(f"/agents/{agent['id']}", json=payload, headers=headers)).json()["name"] == "Editor"
    assert (await client.delete(f"/agents/{agent['id']}", headers=headers)).status_code == 204
    assert (await client.get(f"/agents/{agent['id']}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_workflow_crud_and_real_llm_run(client, session_factory, monkeypatch):
    _, headers = await identity(session_factory)
    _, other = await identity(session_factory)
    body = flow("start", "llm", "end")
    body["nodes"][1]["config"] = {"prompt": "Answer {{input}} / {{previous}}"}
    response = await client.post("/workflows", json=body, headers=headers)
    assert response.status_code == 201, response.text
    workflow = response.json()
    import app.services.workflow_runner as runner
    calls = []
    class LLM:
        async def complete(self, messages, **kwargs):
            calls.append(messages)
            return "Real injected answer"
    monkeypatch.setattr(runner, "build_llm_provider", lambda: LLM())
    result = await client.post(f"/workflows/{workflow['id']}/runs", json={"input": "hello"}, headers=headers)
    assert result.status_code == 201, result.text
    run = result.json()
    assert run["status"] == "completed"
    assert run["output"] == "Real injected answer"
    assert [n["node_id"] for n in run["node_results"]] == ["0", "1", "2"]
    assert calls[-1][-1]["content"] == "Answer hello / hello"
    assert (await client.get(f"/workflow-runs/{run['id']}", headers=headers)).json() == run
    assert len((await client.get("/workflow-runs", headers=headers)).json()) == 1
    assert (await client.get("/workflow-runs", headers=other)).json() == []
    assert (await client.get(f"/workflow-runs/{run['id']}", headers=other)).status_code == 404
    assert (await client.get("/workflows", headers=other)).json() == []
    for method in ("get", "put", "delete"):
        kwargs = {"json": body} if method == "put" else {}
        assert (await getattr(client, method)(f"/workflows/{workflow['id']}", headers=other, **kwargs)).status_code == 404
    body["name"] = "Changed"
    assert (await client.put(f"/workflows/{workflow['id']}", json=body, headers=headers)).json()["name"] == "Changed"
    assert (await client.delete(f"/workflows/{workflow['id']}", headers=headers)).status_code == 204
    assert (await client.get(f"/workflow-runs/{run['id']}", headers=headers)).status_code == 200
