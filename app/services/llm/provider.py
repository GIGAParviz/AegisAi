from __future__ import annotations

import json
from collections.abc import (
    AsyncIterator,
    Mapping,
    Sequence,
)
from typing import Any, Protocol

import httpx

from app.core.config import settings

Message = Mapping[str, Any]


class LLMProviderError(RuntimeError):
    pass


class LLMProvider(Protocol):
    async def complete(
        self,
        messages: Sequence[Message],
        **kwargs: Any,
    ) -> str: ...

    def stream(
        self,
        messages: Sequence[Message],
        **kwargs: Any,
    ) -> AsyncIterator[str]: ...


class OpenAICompatProvider:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        timeout: float = 60.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self.transport = transport

    def _headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
        }

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        return headers

    def _payload(
        self,
        messages: Sequence[Message],
        stream: bool,
        kwargs: Mapping[str, Any],
    ) -> dict[str, Any]:
        options = dict(kwargs)

        model = options.pop(
            "model",
            self.model,
        )

        options.pop(
            "stream",
            None,
        )

        return {
            "model": model,
            "messages": [dict(message) for message in messages],
            **options,
            "stream": stream,
        }

    async def complete(
        self,
        messages: Sequence[Message],
        **kwargs: Any,
    ) -> str:
        payload = self._payload(
            messages,
            False,
            kwargs,
        )

        async with httpx.AsyncClient(
            timeout=self.timeout,
            transport=self.transport,
        ) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )

        response.raise_for_status()

        data = response.json()

        try:
            content = data["choices"][0]["message"]["content"]
        except (
            KeyError,
            IndexError,
            TypeError,
        ) as exc:
            raise LLMProviderError("Invalid chat completion response") from exc

        if content is None:
            return ""

        if not isinstance(content, str):
            raise LLMProviderError("Expected text content from LLM")

        return content

    async def stream(
        self,
        messages: Sequence[Message],
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        payload = self._payload(
            messages,
            True,
            kwargs,
        )
        async with httpx.AsyncClient(
            timeout=self.timeout,
            transport=self.transport,
        ) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    line = line.strip()

                    if not line:
                        continue

                    if line.startswith(":"):
                        continue

                    if not line.startswith("data:"):
                        continue

                    raw_data = line[len("data:") :].strip()

                    if raw_data == "[DONE]":
                        break

                    try:
                        event = json.loads(raw_data)
                    except json.JSONDecodeError as exc:
                        raise LLMProviderError("Invalid SSE JSON from LLM") from exc

                    choices = event.get(
                        "choices",
                        [],
                    )

                    if not choices:
                        continue

                    delta = choices[0].get("delta") or {}

                    content = delta.get("content")

                    if isinstance(content, str) and content:
                        yield content


def build_llm_provider() -> LLMProvider:
    provider = settings.llm_provider.lower()

    if provider in {
        "openai_compat",
        "local",
    }:
        return OpenAICompatProvider(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
        )

    raise ValueError(f"Unsupported LLM provider: {provider}")
