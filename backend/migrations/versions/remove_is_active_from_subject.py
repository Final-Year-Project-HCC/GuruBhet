"""Keep is_active field on Subject

This migration was neutralized to keep the is_active field for 
staff management purposes.

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
    """Upgrade: No-op (field is kept)."""
    pass


def downgrade() -> None:
    """Downgrade: No-op."""
    pass
