"""add duration_seconds to sessions

Revision ID: add_duration_seconds
Revises: a7b3c9d2e4f5
Create Date: 2025-01-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_duration_seconds'
down_revision: Union[str, Sequence[str], None] = 'a7b3c9d2e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add duration_seconds column
    op.add_column('sessions', sa.Column('duration_seconds', sa.Integer(), nullable=True))
    
    # Drop old check constraint
    op.drop_constraint('chk_duration_positive', 'sessions', type_='check')
    
    # Add new check constraint
    op.create_check_constraint(
        'chk_duration_seconds_positive',
        'sessions',
        'duration_seconds IS NULL OR duration_seconds > 0'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop new check constraint
    op.drop_constraint('chk_duration_seconds_positive', 'sessions', type_='check')
    
    # Add old check constraint back
    op.create_check_constraint(
        'chk_duration_positive',
        'sessions',
        'duration_minutes > 0'
    )
    
    # Remove duration_seconds column
    op.drop_column('sessions', 'duration_seconds')
