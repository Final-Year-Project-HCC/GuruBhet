"""merge heads

Revision ID: 8e58acb7b83a
Revises: 63fba413875d, rename_headline_tagline_001
Create Date: 2026-04-11 18:52:35.443249

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e58acb7b83a'
down_revision: Union[str, Sequence[str], None] = ('63fba413875d', 'rename_headline_tagline_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
