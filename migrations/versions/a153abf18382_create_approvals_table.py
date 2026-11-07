"""create approvals table

Revision ID: a153abf18382
Revises: f2b7d4a1c9e0
Create Date: 2026-11-07 09:09:52.265835

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a153abf18382'
down_revision: Union[str, Sequence[str], None] = 'f2b7d4a1c9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('approvals',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('graph_run_id', sa.String(length=255), nullable=False),
    sa.Column('action', sa.String(length=100), nullable=False),
    sa.Column('proposal_json', sa.Text(), nullable=False),
    sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='approval_status'), nullable=False),
    sa.Column('decided_by', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['decided_by'], ['users.id'], name=op.f('fk_approvals_decided_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_approvals'))
    )
    op.create_index(op.f('ix_approvals_action'), 'approvals', ['action'], unique=False)
    op.create_index(op.f('ix_approvals_graph_run_id'), 'approvals', ['graph_run_id'], unique=False)
    op.create_index(op.f('ix_approvals_status'), 'approvals', ['status'], unique=False)

    if op.get_bind().dialect.name == 'postgresql':
        op.execute("ALTER TYPE policy_decision ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL'")


def downgrade() -> None:
    op.drop_index(op.f('ix_approvals_status'), table_name='approvals')
    op.drop_index(op.f('ix_approvals_graph_run_id'), table_name='approvals')
    op.drop_index(op.f('ix_approvals_action'), table_name='approvals')
    op.drop_table('approvals')
    if op.get_bind().dialect.name == 'postgresql':
        pass
