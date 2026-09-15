from __future__ import annotations

import asyncio
import hashlib
from collections.abc import Iterator, Sequence
from typing import Protocol

import httpx

from app.core.config import settings

Vector = list[float]


class EmbeddingProvider(Protocol):
    async def embed(
        self,
        texts: Sequence[str],
    ) -> list[Vector]:
        ...


def _batched(
    texts: Sequence[str],
    batch_size: int,
) -> Iterator[list[str]]:
    if batch_size <= 0:
        raise ValueError(
            "batch_size must be greater than zero"
        )

    for start in range(
        0,
        len(texts),
        batch_size,
    ):
        yield list(
            texts[start : start + batch_size]
        )


class FakeEmbeddingProvider:
    def __init__(
        self,
        dimensions: int = 384,
    ):
        if dimensions <= 0:
            raise ValueError(
                "dimensions must be greater than zero"
            )

        self.dimensions = dimensions

    async def embed(
        self,
        texts: Sequence[str],
    ) -> list[Vector]:
        return [
            self._vector_for(text)
            for text in texts
        ]

    def _vector_for(
        self,
        text: str,
    ) -> Vector:
        values: list[float] = []

        counter = 0

        while len(values) < self.dimensions:
            digest = hashlib.sha256(
                f"{counter}:{text}".encode()
            ).digest()

            values.extend(
                (byte / 127.5) - 1.0
                for byte in digest
            )

            counter += 1

        return values[:self.dimensions]


class LocalSTProvider:
    def __init__(
        self,
        model_name: str,
        batch_size: int = 32,
    ):
        self.model_name = model_name
        self.batch_size = batch_size
        self._model = None

    async def embed(
        self,
        texts: Sequence[str],
    ) -> list[Vector]:
        if not texts:
            return []

        return await asyncio.to_thread(
            self._embed_sync,
            list(texts),
        )

    def _embed_sync(
        self,
        texts: list[str],
    ) -> list[Vector]:
        if self._model is None:
            try:
                from sentence_transformers import (
                    SentenceTransformer,
                )
            except ImportError as exc:
                raise RuntimeError(
                    "Local embeddings require "
                    "sentence-transformers. "
                    "Install the local-embeddings extra."
                ) from exc

            self._model = SentenceTransformer(
                self.model_name
            )

        vectors = self._model.encode(
            texts,
            batch_size=self.batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
        )

        return vectors.tolist()


class OpenAICompatProvider:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        batch_size: int = 32,
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.batch_size = batch_size
        self.timeout = timeout

    async def embed(
        self,
        texts: Sequence[str],
    ) -> list[Vector]:
        if not texts:
            return []

        vectors: list[Vector] = []

        headers = {
            "Authorization": (
                f"Bearer {self.api_key}"
            ),
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(
            timeout=self.timeout,
        ) as client:
            for batch in _batched(
                texts,
                self.batch_size,
            ):
                response = await client.post(
                    f"{self.base_url}/embeddings",
                    headers=headers,
                    json={
                        "model": self.model,
                        "input": batch,
                    },
                )

                response.raise_for_status()

                payload = response.json()

                data = sorted(
                    payload["data"],
                    key=lambda item: item["index"],
                )

                if len(data) != len(batch):
                    raise ValueError(
                        "Embedding provider returned "
                        "an unexpected number of vectors"
                    )

                vectors.extend(
                    [
                        list(
                            map(
                                float,
                                item["embedding"],
                            )
                        )
                        for item in data
                    ]
                )

        return vectors


def build_embedding_provider() -> EmbeddingProvider:
    provider = settings.embedding_provider.lower()

    if provider == "local":
        return LocalSTProvider(
            model_name=settings.embedding_model,
            batch_size=settings.embedding_batch_size,
        )

    if provider == "openai_compat":
        return OpenAICompatProvider(
            base_url=settings.embedding_base_url,
            api_key=settings.embedding_api_key,
            model=settings.embedding_model,
            batch_size=settings.embedding_batch_size,
        )

    if provider == "fake":
        return FakeEmbeddingProvider()

    raise ValueError(
        f"Unsupported embedding provider: {provider}"
    )