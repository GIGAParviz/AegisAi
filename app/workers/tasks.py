import asyncio
from uuid import UUID

from sqlalchemy import select

from app.db.engine import async_session_factory
from app.db.models.document import Document, DocumentStatus
from app.workers.celery_app import celery_app


@celery_app.task(name="ingest_document")
def ingest_document(document_id: str):
    return asyncio.run(_process_document(document_id))


async def _process_document(document_id: str):
    document = None

    async with async_session_factory() as session:
        try:
            result = await session.execute(
                select(Document).where(
                    Document.id == UUID(document_id)
                )
            )

            document = result.scalar_one_or_none()

            if document is None:
                raise ValueError(
                    f"Document {document_id} not found"
                )

            # idempotency
            if document.status == DocumentStatus.READY:
                return {
                    "document_id": document_id,
                    "status": "already_processed",
                }

            document.status = DocumentStatus.PROCESSING
            document.error = None

            await session.commit()

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