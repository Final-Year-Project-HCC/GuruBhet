"""Add RATE_YOUR_TEACHER to notificationtype enum

Revision ID: e8f9a0b1c2d3
Revises: d4e5f6a7b8c9
Create Date: 2026-05-03

"""
from alembic import op

revision = "e8f9a0b1c2d3"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ADD VALUE is not transactional in Postgres — must run outside a transaction block.
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'RATE_YOUR_TEACHER'")


def downgrade() -> None:
    # Postgres does not support removing enum values; this is intentionally a no-op.
    pass
