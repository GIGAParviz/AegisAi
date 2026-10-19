from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.db.models.document import DocumentStatus


class DocumentResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: UUID
    filename: str
    mime: str
    status: DocumentStatus
    error: str | None
    owner_id: UUID
    created_at: datetime
