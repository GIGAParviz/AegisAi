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
        assert request.url.path == "/v1/chat/completions"

        payload = json.loads(request.content)

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

    transport = httpx.MockTransport(handler)

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
        payload = json.loads(request.content)

        assert payload["stream"] is True

        body = (
            'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n'
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'
            'data: {"choices":[]}\n\n'
            "data: [DONE]\n\n"
        )

        return httpx.Response(
            200,
            headers={
                "Content-Type": "text/event-stream",
            },
            content=body.encode(),
        )

    transport = httpx.MockTransport(handler)

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


@pytest.mark.asyncio
async def test_web_search_stream_returns_clickable_citation_offsets():
    text = "سلام 🌐"
    source = {"type": "url_citation", "url": "https://example.com", "title": "Source", "end_index": len(text)}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/responses"
        payload = json.loads(request.content)
        assert payload["tools"] == [{"type": "web_search"}]
        assert payload["tool_choice"] == "required"
        assert payload["store"] is False
        events = [
            {"type": "response.output_text.delta", "delta": text},
            {"type": "response.completed", "response": {"output": [
                {"type": "web_search_call"},
                {"type": "message", "content": [{"type": "output_text", "text": text, "annotations": [
                    source, {**source, "url": "javascript:alert(1)"},
                ]}]},
            ]}},
        ]
        return httpx.Response(200, text="".join(f"data: {json.dumps(event)}\n\n" for event in events))

    provider = OpenAICompatProvider(
        base_url="https://api.openai.com/v1", api_key="test-key", model="test-model",
        transport=httpx.MockTransport(handler),
    )
    events = [event async for event in provider.stream_web_search([{"role": "user", "content": "Search"}])]
    assert events == [text, {"url": source["url"], "title": source["title"], "end_index": len(text)}]
