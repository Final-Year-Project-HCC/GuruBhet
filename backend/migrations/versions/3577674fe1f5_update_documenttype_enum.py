"""Update DocumentType Enum

Revision ID: 3577674fe1f5
Revises: 086c9e8420e9
Create Date: 2026-04-09 15:12:53.153758

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3577674fe1f5'
down_revision: Union[str, Sequence[str], None] = '086c9e8420e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'selfie_with_nid'")

def downgrade() -> None:
    """Downgrade schema."""
    pass
