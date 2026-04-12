"""merge heads for trigram index

Revision ID: 1bebe383a9e3
Revises: 8e58acb7b83a, add_subjects_trgm_index
Create Date: 2026-04-12 14:10:49.394151

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1bebe383a9e3'
down_revision: Union[str, Sequence[str], None] = ('8e58acb7b83a', 'add_subjects_trgm_index')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
