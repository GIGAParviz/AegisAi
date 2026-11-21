import copy

import pytest

from tests.test_workflows import flow, identity


@pytest.mark.asyncio
@pytest.mark.parametrize("case", ["cycle", "unreachable", "duplicate", "dangling", "branch", "handle", "extra_config", "wrong_type", "unknown_template", "unsafe_tool", "too_many", "incoming_start"])
async def test_invalid_dags_rejected(client, session_factory, case):
    _, headers = await identity(session_factory)
    body = flow("start", "llm", "end")
    body["nodes"][1]["config"] = {"prompt": "{{input}}"}
    if case == "cycle":
        body["edges"].append({"id": "back", "source": "2", "target": "1"})
    elif case == "unreachable":
        body["nodes"].append({**copy.deepcopy(body["nodes"][1]), "id": "orphan"})
    elif case == "duplicate":
        body["nodes"][1]["id"] = "0"
    elif case == "dangling":
        body["edges"][0]["target"] = "missing"
    elif case == "branch":
        body["nodes"][1].update(type="condition", config={"contains": "yes"})
    elif case == "handle":
        body["edges"][0]["sourceHandle"] = "true"
    elif case == "extra_config":
        body["nodes"][0]["config"] = {"python": "pass"}
    elif case == "wrong_type":
        body["nodes"][1].update(type="retrieve", config={"query": "x", "limit": "2"})
    elif case == "unknown_template":
        body["nodes"][1]["config"]["prompt"] = "{{secrets}}"
    elif case == "unsafe_tool":
        body["nodes"][1].update(type="tool", config={"name": "http", "arguments": {"url": "https://x"}})
    elif case == "too_many":
        body = flow("start", *(["approval"] * 49), "end")
    elif case == "incoming_start":
        body["edges"][0]["target"] = "0"
    response = await client.post("/workflows", json=body, headers=headers)
    assert response.status_code == 422, response.text


@pytest.mark.asyncio
async def test_valid_condition_branches_and_bounds(client, session_factory):
    _, headers = await identity(session_factory)
    body = flow("start", "condition", "end", "end")
    body["nodes"][1]["config"] = {"contains": "yes"}
    body["edges"] = [body["edges"][0], {"id": "true", "source": "1", "target": "2", "sourceHandle": "true"}, {"id": "false", "source": "1", "target": "3", "sourceHandle": "false"}]
    response = await client.post("/workflows", json=body, headers=headers)
    assert response.status_code == 201, response.text
    result = await client.post(f"/workflows/{response.json()['id']}/runs", json={"input": "x" * 16001}, headers=headers)
    assert result.status_code == 422
