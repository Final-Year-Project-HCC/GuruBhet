"""remove_is_active_from_hierarchy

Revision ID: 40912839d228
Revises: uniform_faculty_002
Create Date: 2026-04-06 13:20:21.738391

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40912839d228'
down_revision: Union[str, Sequence[str], None] = 'uniform_faculty_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Drop is_active from StudyLevel, Board, Faculty."""
    # Use raw SQL with IF EXISTS to safely drop columns that may not exist yet
    op.execute("ALTER TABLE IF EXISTS study_levels DROP COLUMN IF EXISTS is_active")
    op.execute("ALTER TABLE IF EXISTS boards DROP COLUMN IF EXISTS is_active")
    op.execute("ALTER TABLE IF EXISTS faculties DROP COLUMN IF EXISTS is_active")


def downgrade() -> None:
    """Downgrade schema: Add is_active back to StudyLevel, Board, Faculty, Subject."""
    # Add is_active back to subjects (if we dropped it)
    # op.add_column('subjects', sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))

    # Add is_active back to faculties
    op.add_column('faculties', sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))

    # Add is_active back to boards
    op.add_column('boards', sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))

    # Add is_active back to study_levels
    op.add_column('study_levels', sa.Column('is_active', sa.BOOLEAN(), server_default=sa.text('true'), nullable=False))
