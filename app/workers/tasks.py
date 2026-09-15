import asyncio
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from app.db.engine import async_session_factory
from app.db.models.document import Document, DocumentStatus
from app.db.models.document_chunk import DocumentChunk
from app.services.chunker import TextChunker
from app.services.embeddings import (
    build_embedding_provider,
)
from app.services.extractors import extract
from app.services.vector_store import (
    VectorChunk,
    build_vector_store,
)
from app.workers.celery_app import celery_app

UPLOAD_DIR = Path("uploads")


@celery_app.task(name="ingest_document")
def ingest_document(document_id: str):
    return asyncio.run(_process_document(document_id))

def _extract_heading(
    text: str,
) -> str | None:
    for line in text.splitlines():
        line = line.strip()

        if not line:
            continue

        if line.startswith("#"):
            return line.lstrip("#").strip()

        return None

    return None

async def _process_document(document_id: str):
    document = None

    async with async_session_factory() as session:
        try:
            result = await session.execute(
                select(Document).where(Document.id == UUID(document_id))
            )

            document = result.scalar_one_or_none()

            if document is None:
                raise ValueError(f"Document {document_id} not found")

            # idempotency
            if document.status == DocumentStatus.READY:
                return {
                    "document_id": document_id,
                    "status": "already_processed",
                }

            document.status = DocumentStatus.PROCESSING
            document.error = None

            await session.commit()

            file_path = UPLOAD_DIR / f"{document.id}_{document.filename}"

            text = extract(file_path)

            chunker = TextChunker()
            chunks = chunker.chunk(text)

            embedding_provider = build_embedding_provider()

            texts = [chunk.content for chunk in chunks]

            dense_vectors = await embedding_provider.embed(texts)

            vector_chunks: list[VectorChunk] = []

            for index, (chunk, dense_vector) in enumerate(
                zip(chunks, dense_vectors, strict=True)
            ):
                heading = _extract_heading(chunk.content)

                session.add(
                    DocumentChunk(
                        document_id=document.id,
                        chunk_index=index,
                        content=chunk.content,
                        token_count=chunk.token_count,
                    )
                )
                
                vector_chunks.append(
                    VectorChunk(
                        document_id=str(document.id),
                        chunk_index=index,
                        text=chunk.content,
                        dense_vector=dense_vector,
                        heading=heading,
                    )
                )

            vector_store = build_vector_store(
                embedding_provider
            )

            await vector_store.ensure_collection()

            await vector_store.upsert_chunks(
                vector_chunks
            )
            
            document.status = DocumentStatus.READY
            await session.commit()

            return {
                "document_id": document_id,
                "status": "ready",
            }

        except Exception as exc:
            await session.rollback()

            if document is not None:
                document.status = DocumentStatus.FAILED
                document.error = str(exc)

                await session.commit()

            raise
