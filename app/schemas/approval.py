from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.db.models.approval import ApprovalStatus


class ApprovalDecisionRequest(BaseModel):
    decision: Literal["approve", "reject"]


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    graph_run_id: str
    action: str
    status: ApprovalStatus
    created_at: datetime
    decided_at: datetime | None
    decided_by: UUID | None


class ApprovalDecisionResponse(BaseModel):
    approval: ApprovalResponse
    final_response: str | None
