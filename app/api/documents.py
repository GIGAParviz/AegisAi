import uuid
from pathlib import Path
from typing import Annotated

import aiofiles
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.engine import get_session
from app.db.models.document import Document, DocumentStatus
from app.db.models.user import User
from app.schemas.document import DocumentResponse

router = APIRouter(
    prefix="/documents",
    tags=["documents"],
)

UPLOAD_DIR = Path("uploads")


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=DocumentResponse,
)
async def upload_document(
    file: Annotated[
        UploadFile,
        File(),
    ],
    session: Annotated[
        AsyncSession,
        Depends(get_session),
    ],
    current_user: Annotated[
        User,
        Depends(get_current_user),
    ],
) -> Document:

    document_id = uuid.uuid4()

    filename = Path(
        file.filename or "upload.bin",
    ).name

    mime = file.content_type or "application/octet-stream"

    document = Document(
        id=document_id,
        filename=filename,
        mime=mime,
        status=DocumentStatus.QUEUED,
        owner_id=current_user.id,
    )

    UPLOAD_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    file_path = UPLOAD_DIR / f"{document_id}_{filename}"

    try:
        async with aiofiles.open(
            file_path,
            "wb",
        ) as output:
            while chunk := await file.read(1024 * 1024):
                await output.write(chunk)

    except OSError as exc:
        document.status = DocumentStatus.FAILED
        document.error = "Failed to store uploaded file"

        session.add(document)
        await session.commit()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store uploaded file",
        ) from exc

    finally:
        await file.close()

    session.add(document)
    await session.commit()

    await session.refresh(document)

    return document

@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
)
async def get_document(
    document_id: uuid.UUID,
    session: Annotated[
        AsyncSession,
        Depends(get_session),
    ],
    current_user: Annotated[
        User,
        Depends(get_current_user),
    ],
) -> Document:
    result = await session.execute(
        select(Document).where(
            Document.id == document_id,
            Document.owner_id == current_user.id,
        )
    )

    document = result.scalar_one_or_none()

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document
