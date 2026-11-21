"""Persist builder definitions and workflow execution checkpoints.

Revision ID: b19d7a42ce01
Revises: a153abf18382
"""
import sqlalchemy as sa
from alembic import op

revision = "b19d7a42ce01"
down_revision = "a153abf18382"
branch_labels = None
depends_on = None


def definition_columns():
    return [sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)]


def upgrade():
    op.create_table("agent_definitions", *definition_columns(),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("model", sa.String(200), nullable=False),
        sa.Column("allowed_tools", sa.JSON(), nullable=False),
        sa.Column("requires_approval", sa.Boolean(), nullable=False))
    op.create_index("ix_agent_definitions_owner_id", "agent_definitions", ["owner_id"])
    op.create_table("workflows", *definition_columns(),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("nodes", sa.JSON(), nullable=False),
        sa.Column("edges", sa.JSON(), nullable=False))
    op.create_index("ix_workflows_owner_id", "workflows", ["owner_id"])
    op.create_table("workflow_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("workflow_id", sa.Uuid(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("actor", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("input", sa.Text(), nullable=False),
        sa.Column("output", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("node_results", sa.JSON(), nullable=False),
        sa.Column("pending_node_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    for key in ("owner_id", "workflow_id", "status"):
        op.create_index(f"ix_workflow_runs_{key}", "workflow_runs", [key])


def downgrade():
    op.drop_table("workflow_runs")
    op.drop_table("workflows")
    op.drop_table("agent_definitions")
