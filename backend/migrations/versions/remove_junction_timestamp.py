"""Remove created_at column from board_study_levels junction table

The board_study_levels junction table should only contain the two foreign keys
(board_id and study_level_id). The created_at column is unnecessary for a
pure association/junction table and creates a mismatch with the ORM model.

This migration removes the unnecessary created_at column.

Revision ID: remove_junction_timestamp
Revises: impl_board_study_level_m2m
Create Date: 2026-04-06 15:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_junction_timestamp'
down_revision: Union[str, Sequence[str], None] = 'impl_board_study_level_m2m'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade: Remove created_at column from board_study_levels."""
    op.drop_column('board_study_levels', 'created_at')


def downgrade() -> None:
    """Downgrade: Restore created_at column to board_study_levels."""
    op.add_column('board_study_levels',
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
