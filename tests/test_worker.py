import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.security import hash_pass
from app.db.models.document import Document, DocumentStatus
from app.db.models.user import User, UserRole
from app.workers.celery_app import celery_app
from app.workers.tasks import ingest_document


@pytest.mark.asyncio
async def test_ingest_document_changes_status(
    db_session,
    session_factory,
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

    document_id = document.id

    result = await asyncio.to_thread(
        ingest_document.delay,
        str(document_id),
    )

    assert result.successful()

    await db_session.close()

    async with session_factory() as session:
        db_result = await session.execute(
            select(Document).where(Document.id == document_id)
        )

        updated_document = db_result.scalar_one()

    assert updated_document.status == DocumentStatus.READY
