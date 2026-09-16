import json

import httpx
import pytest

from app.services.llm.provider import (
    OpenAICompatProvider,
)


@pytest.mark.asyncio
async def test_complete_returns_content():
    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        assert (
            request.url.path
            == "/v1/chat/completions"
        )

        payload = json.loads(
            request.content
        )

        assert payload["model"] == "test-model"
        assert payload["stream"] is False

        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Hello",
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(
        handler
    )

    provider = OpenAICompatProvider(
        base_url="https://test.local/v1",
        api_key="test-key",
        model="test-model",
        transport=transport,
    )

    result = await provider.complete(
        [
            {
                "role": "user",
                "content": "Hi",
            }
        ],
        temperature=0.2,
    )

    assert result == "Hello"
    
    
    
@pytest.mark.asyncio
async def test_stream_collects_chunks():
    def handler(
        request: httpx.Request,
    ) -> httpx.Response:
        payload = json.loads(
            request.content
        )

        assert payload["stream"] is True

        body = (
            'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n'
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'
            'data: {"choices":[]}\n\n'
            'data: [DONE]\n\n'
        )

        return httpx.Response(
            200,
            headers={
                "Content-Type":
                    "text/event-stream",
            },
            content=body.encode(),
        )

    transport = httpx.MockTransport(
        handler
    )

    provider = OpenAICompatProvider(
        base_url="https://test.local/v1",
        api_key="test-key",
        model="test-model",
        transport=transport,
    )

    chunks = [
        chunk
        async for chunk in provider.stream(
            [
                {
                    "role": "user",
                    "content": "Hi",
                }
            ]
        )
    ]

    assert chunks == [
        "Hel",
        "lo",
    ]

    assert "".join(chunks) == "Hello"