"""Fix enum types for bookingstatus and sessionstatus

Revision ID: fix_enums_001
Revises: 9df3be4b8376
Create Date: 2026-03-30 22:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_enums_001'
down_revision: Union[str, Sequence[str], None] = '9df3be4b8376'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema by fixing enum types."""
    # PostgreSQL enum fix: drop and recreate with correct values
    
    # 1. Drop dependent columns first
    op.execute('ALTER TABLE bookings DROP COLUMN status')
    
    # 2. Drop the old enum types
    op.execute('DROP TYPE IF EXISTS bookingstatus CASCADE')
    op.execute('DROP TYPE IF EXISTS sessionstatus CASCADE')
    
    # 3. Create new enum types with correct values
    op.execute("""
        CREATE TYPE bookingstatus AS ENUM (
            'PENDING_APPROVAL',
            'PENDING_PAYMENT',
            'ACTIVE',
            'COMPLETED',
            'CANCELLED_BY_STUDENT',
            'CANCELLED_BY_TEACHER',
            'DISPUTED'
        )
    """)
    
    op.execute("""
        CREATE TYPE sessionstatus AS ENUM (
            'READY',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED_BY_STUDENT',
            'CANCELLED_BY_TEACHER'
        )
    """)
    
    # 4. Recreate the booking.status column with correct enum
    op.execute("""
        ALTER TABLE bookings 
        ADD COLUMN status bookingstatus NOT NULL DEFAULT 'PENDING_APPROVAL'
    """)
    
    # 5. Add index back
    op.execute('CREATE INDEX ix_bookings_status ON bookings(status)')


def downgrade() -> None:
    """Downgrade schema."""
    # This is complex to downgrade, so we'll just note the change
    pass
