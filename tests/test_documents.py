from uuid import UUID

import pytest
from sqlalchemy import select

import app.api.documents as doc_api
from app.core.security import create_access_token, hash_pass
from app.db.models.document import Document, DocumentStatus
from app.db.models.user import User, UserRole


@pytest.mark.asyncio
async def test_upload_and_get_document(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    upload_dir = tmp_path / "uploads"

    monkeypatch.setattr(
        doc_api,
        "UPLOAD_DIR",
        upload_dir,
    )

    user = User(
        email="document-user@example.com",
        hashed_password=hash_pass("secret123"),
        role=UserRole.USER,
    )

    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    access_token = create_access_token(str(user.id))

    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    upload_response = await client.post(
        "/documents",
        headers=headers,
        files={
            "file": (
                "notes.txt",
                b"Hello AegisAI",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 202

    data = upload_response.json()

    assert data["filename"] == "notes.txt"
    assert data["mime"] == "text/plain"
    assert data["status"] == "queued"
    assert data["error"] is None
    assert data["owner_id"] == str(user.id)

    document_id = UUID(data["id"])

    result = await db_session.execute(
        select(Document).where(Document.id == document_id)
    )

    document = result.scalar_one()

    assert document.status == DocumentStatus.QUEUED
    assert document.owner_id == user.id

    stored_file = upload_dir / f"{document.id}_{document.filename}"

    assert stored_file.exists()

    get_response = await client.get(
        f"/documents/{document_id}",
        headers=headers,
    )

    assert get_response.status_code == 200

    fetched = get_response.json()

    assert fetched["id"] == str(document_id)
    assert fetched["filename"] == "notes.txt"
    assert fetched["status"] == "queued"
