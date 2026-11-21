"""Owner-scoped builder definitions and durable execution checkpoints."""
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OwnedDefinition:
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class AgentDefinition(OwnedDefinition, Base):
    __tablename__ = "agent_definitions"
    system_prompt: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(200), default="")
    allowed_tools: Mapped[list] = mapped_column(JSON, default=list)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)


class Workflow(OwnedDefinition, Base):
    __tablename__ = "workflows"
    description: Mapped[str] = mapped_column(Text, default="")
    nodes: Mapped[list] = mapped_column(JSON)
    edges: Mapped[list] = mapped_column(JSON)


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    # Historical identifier deliberately survives definition deletion.
    workflow_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    snapshot: Mapped[dict] = mapped_column(JSON)
    actor: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="running", index=True)
    input: Mapped[str] = mapped_column(Text)
    output: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    node_results: Mapped[list] = mapped_column(JSON, default=list)
    pending_node_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
