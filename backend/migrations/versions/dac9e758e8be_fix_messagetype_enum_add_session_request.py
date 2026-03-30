"""fix_messagetype_enum_add_session_request

Revision ID: dac9e758e8be
Revises: 37b13f3f68e4
Create Date: 2026-03-30 23:19:39.674092

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dac9e758e8be'
down_revision: Union[str, Sequence[str], None] = '37b13f3f68e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add SESSION_REQUEST to messagetype enum if it doesn't exist
    op.execute("""
    DO $$ 
    BEGIN
        -- First check if the value already exists
        IF NOT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid = 'messagetype'::regtype AND enumlabel = 'SESSION_REQUEST') THEN
            -- Add the new enum value to the end
            ALTER TYPE messagetype ADD VALUE 'SESSION_REQUEST';
        END IF;
    END$$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL doesn't support removing enum values, so we can't downgrade this
    pass
