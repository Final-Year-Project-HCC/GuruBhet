"""merge avatar_url migration and previous head

Revision ID: 63fba413875d
Revises: 2026moveavatarurltouser, 58384ab24c18
Create Date: 2026-04-11 14:56:04.063453

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63fba413875d'
down_revision: Union[str, Sequence[str], None] = ('2026moveavatarurltouser', '58384ab24c18')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
