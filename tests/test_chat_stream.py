import json

import pytest

import app.api.chat as chat_api


class FakeProvider:
    async def stream(self, messages):
        yield "Hel"
        yield "lo"


@pytest.mark.asyncio
async def test_chat_stream_returns_sse(client, monkeypatch):
    monkeypatch.setattr(
        chat_api,
        "build_llm_provider",
        lambda: FakeProvider(),
    )

    response = await client.post(
        "/chat/stream",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "Hi",
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "text/event-stream"
    )
    assert response.headers["cache-control"] == "no-cache"

    blocks = response.text.strip().split("\n\n")

    token_data = [
        json.loads(line.removeprefix("data: "))
        for block in blocks
        if block.startswith("event: token")
        for line in block.splitlines()
        if line.startswith("data:")
    ]

    assert "".join(token_data) == "Hello"

    done_block = next(
        block for block in blocks
        if block.startswith("event: done")
    )
    assert "trace_id" in done_block