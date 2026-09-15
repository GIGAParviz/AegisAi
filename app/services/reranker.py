from __future__ import annotations

import asyncio
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from app.core.config import settings


@dataclass(frozen=True)
class RerankScore:
    index: int
    score: float


class Reranker(Protocol):
    async def rerank(
        self,
        query: str,
        documents: Sequence[str],
        top_k: int,
    ) -> list[RerankScore]: ...


class CrossEncoderReranker:
    def __init__(
        self,
        model_name: str,
        batch_size: int = 16,
    ):
        self.model_name = model_name
        self.batch_size = batch_size
        self._model = None

    async def rerank(
        self,
        query: str,
        documents: Sequence[str],
        top_k: int,
    ) -> list[RerankScore]:
        if not documents:
            return []

        if top_k <= 0:
            return []

        scores = await asyncio.to_thread(
            self._predict_sync,
            query,
            list(documents),
        )

        ranked = [
            RerankScore(
                index=index,
                score=score,
            )
            for index, score in enumerate(scores)
        ]

        ranked.sort(
            key=lambda item: item.score,
            reverse=True,
        )

        return ranked[:top_k]

    def _predict_sync(
        self,
        query: str,
        documents: list[str],
    ) -> list[float]:
        if self._model is None:
            try:
                from sentence_transformers import (
                    CrossEncoder,
                )
            except ImportError as exc:
                raise RuntimeError(
                    "Reranking requires "
                    "sentence-transformers. "
                    "Install the local-ml extra."
                ) from exc

            self._model = CrossEncoder(
                self.model_name,
                device="cpu",
            )

        pairs = [(query, document) for document in documents]

        scores = self._model.predict(
            pairs,
            batch_size=self.batch_size,
            show_progress_bar=False,
        )

        return [float(score) for score in scores]


class FakeReranker:
    def __init__(
        self,
        scores_by_text: dict[str, float],
    ):
        self.scores_by_text = scores_by_text

    async def rerank(
        self,
        query: str,
        documents: Sequence[str],
        top_k: int,
    ) -> list[RerankScore]:
        del query

        ranked = [
            RerankScore(
                index=index,
                score=self.scores_by_text.get(
                    document,
                    0.0,
                ),
            )
            for index, document in enumerate(documents)
        ]

        ranked.sort(
            key=lambda item: item.score,
            reverse=True,
        )

        return ranked[:top_k]


def build_reranker() -> Reranker | None:
    if not settings.rerank_enabled:
        return None

    return CrossEncoderReranker(
        model_name=settings.rerank_model,
        batch_size=settings.rerank_batch_size,
    )
