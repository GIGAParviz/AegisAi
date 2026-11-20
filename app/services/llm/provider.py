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
from app.observability.tracing import start_span

Message = Mapping[str, Any]


class LLMProviderError(RuntimeError):
    pass


def _message_summary(messages: Sequence[Message]) -> dict[str, int]:
    return {
        "message_count": len(messages),
        "input_characters": sum(
            len(content)
            for message in messages
            if isinstance((content := message.get("content")), str)
        ),
    }


def _usage_details(usage: Any) -> dict[str, int]:
    if not isinstance(usage, Mapping):
        return {}

    details: dict[str, int] = {}
    prompt_tokens = usage.get("prompt_tokens", usage.get("input_tokens"))
    completion_tokens = usage.get("completion_tokens", usage.get("output_tokens"))
    prompt_metadata = usage.get("prompt_tokens_details")
    completion_metadata = usage.get("completion_tokens_details")
    cached_tokens = (
        prompt_metadata.get("cached_tokens", 0)
        if isinstance(prompt_metadata, Mapping)
        else 0
    )
    reasoning_tokens = (
        completion_metadata.get("reasoning_tokens", 0)
        if isinstance(completion_metadata, Mapping)
        else 0
    )

    if isinstance(prompt_tokens, int):
        details["input"] = max(prompt_tokens - int(cached_tokens or 0), 0)
    if isinstance(cached_tokens, int) and cached_tokens > 0:
        details["input_cached_tokens"] = cached_tokens
    if isinstance(completion_tokens, int):
        details["output"] = max(completion_tokens - int(reasoning_tokens or 0), 0)
    if isinstance(reasoning_tokens, int) and reasoning_tokens > 0:
        details["output_reasoning_tokens"] = reasoning_tokens

    if details:
        details["total"] = sum(details.values())
    return details


def _cost_details(usage: Any) -> dict[str, float]:
    if not isinstance(usage, Mapping):
        return {}
    cost = usage.get("cost")
    if isinstance(cost, (int, float)) and cost >= 0:
        return {"total": float(cost)}
    cost_details = usage.get("cost_details")
    if isinstance(cost_details, Mapping):
        return {
            str(key): float(value)
            for key, value in cost_details.items()
            if isinstance(value, (int, float)) and value >= 0
        }
    return {}


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
        model_parameters = {
            key: value
            for key, value in kwargs.items()
            if key in {"temperature", "max_tokens", "top_p"}
            and isinstance(value, (str, int, float, bool))
        }

        with start_span(
            "llm.complete",
            as_type="generation",
            input=_message_summary(messages),
            model=self.model,
            model_parameters=model_parameters,
        ) as observation:
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
                content = ""
            if not isinstance(content, str):
                raise LLMProviderError("Expected text content from LLM")

            usage = data.get("usage")
            update: dict[str, Any] = {
                "output": {"output_characters": len(content)},
            }
            usage_details = _usage_details(usage)
            cost_details = _cost_details(usage)
            if usage_details:
                update["usage_details"] = usage_details
            if cost_details:
                update["cost_details"] = cost_details
            response_model = data.get("model")
            if isinstance(response_model, str):
                update["model"] = response_model
            observation.update(**update)
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
        model_parameters = {
            key: value
            for key, value in kwargs.items()
            if key in {"temperature", "max_tokens", "top_p"}
            and isinstance(value, (str, int, float, bool))
        }
        output_chunks: list[str] = []
        usage: Any = None
        response_model = self.model

        with start_span(
            "llm.stream",
            as_type="generation",
            input=_message_summary(messages),
            model=self.model,
            model_parameters=model_parameters,
        ) as observation:
            try:
                async with (
                    httpx.AsyncClient(
                        timeout=self.timeout,
                        transport=self.transport,
                    ) as client,
                    client.stream(
                        "POST",
                        f"{self.base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                    ) as response,
                ):
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or line.startswith(":") or not line.startswith("data:"):
                            continue

                        raw_data = line[len("data:") :].strip()
                        if raw_data == "[DONE]":
                            break

                        try:
                            event = json.loads(raw_data)
                        except json.JSONDecodeError as exc:
                            raise LLMProviderError("Invalid SSE JSON from LLM") from exc

                        event_usage = event.get("usage")
                        if isinstance(event_usage, Mapping):
                            usage = event_usage
                        event_model = event.get("model")
                        if isinstance(event_model, str):
                            response_model = event_model

                        choices = event.get("choices", [])
                        if not choices:
                            continue

                        delta = choices[0].get("delta") or {}
                        content = delta.get("content")
                        if isinstance(content, str) and content:
                            output_chunks.append(content)
                            yield content
            finally:
                update: dict[str, Any] = {
                    "output": {"output_characters": sum(map(len, output_chunks))},
                    "model": response_model,
                }
                usage_details = _usage_details(usage)
                cost_details = _cost_details(usage)
                if usage_details:
                    update["usage_details"] = usage_details
                if cost_details:
                    update["cost_details"] = cost_details
                observation.update(**update)


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
