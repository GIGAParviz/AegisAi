from __future__ import annotations

from typing import Protocol

import tiktoken


class Encoding(Protocol):
    def encode(self, text: str) -> list[object]: ...

    def decode(self, tokens: list[object]) -> str: ...


class FallbackEncoding:
    def encode(self, text: str) -> list[str]:
        return text.split()

    def decode(self, tokens: list[str]) -> str:
        return " ".join(tokens)


def get_encoding(name: str) -> Encoding:
    try:
        return tiktoken.get_encoding(name)
    except Exception:  # noqa: BLE001
        return FallbackEncoding()
