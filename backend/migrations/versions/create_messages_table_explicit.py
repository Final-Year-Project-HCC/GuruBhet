"""Explicitly create messages table (fix)

Revision ID: create_messages_explicit
Revises: 39713078d256
Create Date: 2026-04-02 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'create_messages_explicit'
down_revision: Union[str, Sequence[str], None] = '39713078d256'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Enum types already exist from previous migration
    
    # Drop the table if it exists (to recreate it fresh)
    op.execute("DROP TABLE IF EXISTS messages CASCADE")
    
    # Create messages table using raw SQL to avoid enum recreation
    op.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        sender_id UUID NOT NULL,
        receiver_id UUID NOT NULL,
        content TEXT NOT NULL,
        message_type messagetype NOT NULL DEFAULT 'TEXT',
        file_url VARCHAR NULL,
        file_key VARCHAR NULL,
        booking_id UUID NULL,
        session_id UUID NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMP WITH TIME ZONE NULL,
        status messagestatus NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    )
    """)
    
    # Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_message_sender_receiver ON messages(sender_id, receiver_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_message_conversation ON messages(sender_id, receiver_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_message_receiver_unread ON messages(receiver_id, is_read)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_message_created ON messages(created_at)")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('messages')
