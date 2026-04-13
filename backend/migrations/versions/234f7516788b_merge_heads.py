"""merge heads

Revision ID: 234f7516788b
Revises: 1bebe383a9e3, 20260413removestudyboard
Create Date: 2026-04-13 16:04:06.640577

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '234f7516788b'
down_revision: Union[str, Sequence[str], None] = ('1bebe383a9e3', '20260413removestudyboard')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
