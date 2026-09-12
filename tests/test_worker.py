import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.security import hash_pass
from app.db.models.document import Document, DocumentStatus
from app.db.models.document_chunk import DocumentChunk
from app.db.models.user import User, UserRole
from app.workers import tasks as worker_tasks
from app.workers.celery_app import celery_app
from app.workers.tasks import ingest_document


@pytest.mark.asyncio
async def test_ingest_document_changes_status(
    db_session,
    session_factory,
    tmp_path,
    monkeypatch,
):
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )

    user = User(
        email=f"worker-{uuid4()}@example.com",
        hashed_password=hash_pass("secret123"),
        role=UserRole.USER,
    )

    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    document = Document(
        filename="test.txt",
        mime="text/plain",
        status=DocumentStatus.QUEUED,
        owner_id=user.id,
    )

    db_session.add(document)
    await db_session.commit()
    await db_session.refresh(document)

    upload_dir = tmp_path / "uploads"

    upload_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    monkeypatch.setattr(
        worker_tasks,
        "UPLOAD_DIR",
        upload_dir,
    )

    file_path = (
        upload_dir
        / f"{document.id}_{document.filename}"
    )

    file_path.write_text(
        """
# AegisAI

This is a document processing test.

# Worker

Celery extracts and chunks this document.
""".strip(),
        encoding="utf-8",
    )

    document_id = document.id

    result = await asyncio.to_thread(
        ingest_document.delay,
        str(document_id),
    )

    assert result.successful()

    await db_session.close()

    async with session_factory() as session:
        db_result = await session.execute(
            select(Document).where(
                Document.id == document_id
            )
        )

        updated_document = db_result.scalar_one()

        chunk_result = await session.execute(
            select(DocumentChunk)
            .where(
                DocumentChunk.document_id == document_id
            )
            .order_by(
                DocumentChunk.chunk_index
            )
        )

        chunks = chunk_result.scalars().all()

    assert updated_document.status == DocumentStatus.READY

    assert len(chunks) > 0
    assert chunks[0].content
    assert chunks[0].token_count > 0