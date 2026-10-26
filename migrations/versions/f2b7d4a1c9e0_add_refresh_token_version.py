"""add refresh token version

Revision ID: f2b7d4a1c9e0
Revises: ca706e8546f7
Create Date: 2026-10-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2b7d4a1c9e0"
down_revision: str | Sequence[str] | None = "ca706e8546f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "refresh_token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "refresh_token_version")
