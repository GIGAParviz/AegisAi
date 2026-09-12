import asyncio
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from app.db.engine import async_session_factory
from app.db.models.document import Document, DocumentStatus
from app.db.models.document_chunk import DocumentChunk
from app.services.chunker import TextChunker
from app.services.extractors import extract
from app.workers.celery_app import celery_app

UPLOAD_DIR = Path("uploads")


@celery_app.task(name="ingest_document")
def ingest_document(document_id: str):
    return asyncio.run(_process_document(document_id))


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

            for index, chunk in enumerate(chunks):
                session.add(
                    DocumentChunk(
                        document_id=document.id,
                        chunk_index=index,
                        content=chunk.content,
                        token_count=chunk.token_count,
                    )
                )

            # TODO:
            # OCR
            # extraction
            # chunking
            # embeddings

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
