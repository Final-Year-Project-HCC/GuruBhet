"""Remove is_active field from Subject for hard delete only

Subjects will now use hard deletes only. No soft-delete via is_active.
Removes the is_active column from the subjects table.

Revision ID: remove_is_active_from_subject
Revises: remove_junction_timestamp
Create Date: 2026-04-06 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_is_active_from_subject'
down_revision: Union[str, Sequence[str], None] = 'remove_junction_timestamp'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade: Drop is_active column and index from subjects table."""
    op.drop_index('ix_subjects_is_active', table_name='subjects')
    op.drop_column('subjects', 'is_active')


def downgrade() -> None:
    """Downgrade: Restore is_active column to subjects table."""
    op.add_column('subjects',
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False)
    )
    op.create_index('ix_subjects_is_active', 'subjects', ['is_active'])
