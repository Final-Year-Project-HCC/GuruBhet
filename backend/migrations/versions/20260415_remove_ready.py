"""remove READY from sessionstatus enum

Revision ID: 20260415_remove_ready
Revises: 234f7516788b
Create Date: 2026-04-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260415_remove_ready'
down_revision: Union[str, Sequence[str], None] = '234f7516788b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove READY from sessionstatus enum and migrate existing rows.

    Strategy:
    1. Create a new enum type `sessionstatus_new` without READY.
    2. Alter `sessions.status` to use the new type, converting 'READY' -> 'IN_PROGRESS'.
    3. Set default to 'IN_PROGRESS'.
    4. Drop the old enum and rename the new type to `sessionstatus`.
    """
    # 1. create new enum type
    op.execute("""
    CREATE TYPE sessionstatus_new AS ENUM (
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED_BY_STUDENT',
        'CANCELLED_BY_TEACHER'
    );
    """)

    # 2. alter column to new type, mapping READY -> IN_PROGRESS
    # drop existing default first (can't cast default automatically)
    op.execute("""
    ALTER TABLE sessions ALTER COLUMN status DROP DEFAULT;
    """)
    # cast via text to avoid direct enum-to-enum cast issues
    op.execute("""
    ALTER TABLE sessions
    ALTER COLUMN status TYPE sessionstatus_new
    USING (CASE WHEN status = 'READY' THEN 'IN_PROGRESS' ELSE status END)::text::sessionstatus_new;
    """)

    # 3. set new default
    op.execute("""
    ALTER TABLE sessions ALTER COLUMN status SET DEFAULT 'IN_PROGRESS';
    """)

    # 4. drop old type and rename
    op.execute("DROP TYPE IF EXISTS sessionstatus CASCADE;")
    op.execute("ALTER TYPE sessionstatus_new RENAME TO sessionstatus;")


def downgrade() -> None:
    """Downgrade is destructive to data mapping; recreate original enum including READY
    and map any values that were IN_PROGRESS and previously READY back to READY is not
    deterministic. This downgrade will recreate the old enum type and leave existing
    values unchanged.
    """
    op.execute("""
    CREATE TYPE sessionstatus_old AS ENUM (
        'READY',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED_BY_STUDENT',
        'CANCELLED_BY_TEACHER'
    );
    """)
    op.execute("""
    ALTER TABLE sessions
    ALTER COLUMN status TYPE sessionstatus_old
    USING status::text::sessionstatus_old;
    """)
    op.execute("ALTER TABLE sessions ALTER COLUMN status SET DEFAULT 'READY';")
    op.execute("DROP TYPE IF EXISTS sessionstatus CASCADE;")
    op.execute("ALTER TYPE sessionstatus_old RENAME TO sessionstatus;")
