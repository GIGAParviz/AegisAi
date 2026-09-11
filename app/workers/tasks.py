from uuid import UUID

from sqlalchemy import select

from app.core.config import settings
from app.db.engine import async_session_factory
from app.db.models.document import (
    Document,
    DocumentStatus,
)
from app.workers.celery_app import celery_app


@celery_app.task(bind=True, name="ingest_document")
def ingest_document(
    self,
    document_id: str,
):
    import asyncio

    return asyncio.run(_process_document(document_id))


async def _process_document(
    document_id: str,
):

    document = None

    async with async_session_factory() as session:
        try:
            result = await session.execute(
                select(Document).where(Document.id == UUID(document_id))
            )

            document = result.scalar_one()

            document.status = DocumentStatus.PROCESSING

            await session.commit()

            """
            # TODO:
            - OCR
            - extraction
            - chunking
            - embedding
            """

            document.status = DocumentStatus.READY

            await session.commit()

            return {
                "document_id": document_id,
                "status": "ready",
            }

        except Exception as exc:
            if document is not None:
                document.status = DocumentStatus.FAILED
                document.error = str(exc)

                await session.commit()

            raise
