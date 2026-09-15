from __future__ import annotations

import asyncio
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from fastembed import SparseTextEmbedding
from qdrant_client import QdrantClient, models

from app.core.config import settings
from app.services.embeddings import EmbeddingProvider, Vector


@dataclass(frozen=True)
class VectorChunk:
    document_id: str
    chunk_index: int
    text: str
    dense_vector: Vector
    heading: str | None = None


@dataclass(frozen=True)
class SearchResult:
    document_id: str
    chunk_index: int
    text: str
    heading: str | None
    score: int

class VectorStore(Protocol):
    async def ensure_collection(
        self,
    ) -> None: ...

    async def upsert_chunks(
        self,
        chunks: Sequence[VectorChunk],
    ) -> None: ...

    async def hybrid_search(
        self,
        query: str,
        k: int = 5,
    ) -> list[SearchResult]: ...


class SparseBM25Provider:
    def __init__(
        self,
        model_name="Qdrant/bm25",
    ):
        self.model_name = model_name
        self._model = None

    async def embed(self, texts: Sequence[str]) -> list[models.SparseVector]:
        if not texts:
            return []

        return await asyncio.to_thread(
            self._embed_sync,
            list(texts),
        )

    def _embed_sync(
        self,
        texts: list[str],
    ) -> list[models.SparseVector]:
        if self._model is None:
            self._model = SparseTextEmbedding(
                model_name=self.model_name,
            )

        embeddings = list(self._model.embed(texts))

        return [
            models.SparseVector(
                indices=embedding.indices.tolist(),
                values=embedding.values.tolist(),
            )
            for embedding in embeddings
        ]


class QdrantVectorStore:
    def __init__(
        self,
        client: QdrantClient,
        dense_provider: EmbeddingProvider,
        sparse_provider: SparseBM25Provider,
        collection_name: str,
        dense_dimensions: int,
        prefetch_limit: int = 20,
    ):
        self.client = client
        self.dense_provider = dense_provider
        self.sparse_provider = sparse_provider
        self.collection_name = collection_name
        self.dense_dimensions = dense_dimensions
        self.prefetch_limit = prefetch_limit

    async def ensure_collection(
        self,
    ) -> None:
        exists = await asyncio.to_thread(
            self.client.collection_exists,
            self.collection_name,
        )

        if exists:
            return

        await asyncio.to_thread(
            self.client.create_collection,
            collection_name=self.collection_name,
            vectors_config={
                "dense": models.VectorParams(
                    size=self.dense_dimensions,
                    distance=models.Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "sparse": models.SparseVectorParams(
                    modifier=models.Modifier.IDF,
                )
            },
        )

    async def upsert_chunks(
        self,
        chunks: Sequence[VectorChunk],
    ) -> None:
        if not chunks:
            return

        sparse_vectors = await self.sparse_provider.embed(
            [chunk.text for chunk in chunks],
        )

        points: list[models.PointStruct] = []

        for chunk, sparse_vector in zip(
            chunks,
            sparse_vectors,
            strict=True,
        ):
            point_id = str(
                uuid.uuid5(
                    uuid.NAMESPACE_URL, f"{chunk.document_id}:{chunk.chunk_index}"
                )
            )

            points.append(
                models.PointStruct(
                    id=point_id,
                    vector={
                        "dense": chunk.dense_vector,
                        "sparse": sparse_vector,
                    },
                    payload={
                        "doc_id": chunk.document_id,
                        "chunk_index": chunk.chunk_index,
                        "text": chunk.text,
                        "heading": chunk.heading,
                    },
                )
            )

        await asyncio.to_thread(
            self.client.upsert,
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )

    async def hybrid_search(
        self,
        query: str,
        k: int,
    ) -> list[SearchResult]:
        dense_vectors = await self.dense_provider.embed(
            [query],
        )

        sparse_vectors = await self.sparse_provider.embed(
            [query],
        )

        dense_query = dense_vectors[0]
        sparse_query = sparse_vectors[0]

        response = await asyncio.to_thread(
            self.client.query_points,
            collection_name=self.collection_name,
            prefetch=[
                models.Prefetch(
                    query=dense_query,
                    using="dense",
                    limit=self.prefetch_limit,
                ),
                models.Prefetch(
                    query=sparse_query,
                    using="sparse",
                    limit=self.prefetch_limit,
                ),
            ],
            query=models.FusionQuery(
                fusion=models.Fusion.RRF,
            ),
            limit=k,
            with_payload=True,
        )

        results: list[SearchResult] = []

        for point in response.points:
            payload = point.payload or {}

            results.append(
                SearchResult(
                    document_id=str(payload["doc_id"]),
                    chunk_index=int(payload["chunk_index"]),
                    text=str(payload["text"]),
                    heading=payload.get("heading"),
                    score=float(point.score),
                )
            )

        return results


class FakeVectorStore:
    def __init__(self):
        self.chunks: list[VectorChunk] = []
        self.collection_ready = False

    async def ensure_collection(
        self,
    ) -> None:
        self.collection_ready = True

    async def upsert_chunks(
        self,
        chunks: Sequence[VectorChunk],
    ) -> None:
        self.chunks.extend(chunks)

    async def hybrid_search(
        self,
        query: str,
        k: int = 5,
    ) -> list[SearchResult]:
        query_lower = query.lower()

        matching = [chunk for chunk in self.chunks if query_lower in chunk.text.lower()]

        return [
            SearchResult(
                document_id=chunk.document_id,
                chunk_index=chunk.chunk_index,
                text=chunk.text,
                heading=chunk.heading,
                score=1.0,
            )
            for chunk in matching[:k]
        ]


def build_vector_store(
    dense_provider: EmbeddingProvider,
) -> QdrantVectorStore:
    client = QdrantClient(url=settings.qdrant_url)

    sparse_provider = SparseBM25Provider(model_name=settings.sparse_embedding_model)

    return QdrantVectorStore(
        client=client,
        dense_provider=dense_provider,
        sparse_provider=sparse_provider,
        collection_name=settings.qdrant_collection_name,
        dense_dimensions=settings.embedding_dimensions,
        prefetch_limit=settings.hybrid_prefetch_limit,
    )


