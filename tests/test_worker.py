import pytest
from sqlalchemy import select

from app.core.security import hash_pass
from app.db import engine as db_engine
from app.db.models.document import Document, DocumentStatus
from app.db.models.user import User, UserRole
from app.workers.celery_app import celery_app
from app.workers.tasks import _process_document

async_session_factory = db_engine.async_session_factory


@pytest.fixture
def eager_celery():
    celery_app.conf.update(task_always_eager=True)

    yield celery_app

    celery_app.conf.update(task_always_eager=False)


@pytest.mark.asyncio
async def test_ingest_document_changes_status(
    db_session,
):

    from uuid import uuid4

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

    await _process_document(str(document.id))


    await db_session.close()


    async with async_session_factory() as session:
        result = await session.execute(select(Document).where(Document.id == document.id))

        updated_document = result.scalar_one()


    assert updated_document.status == DocumentStatus.READY
