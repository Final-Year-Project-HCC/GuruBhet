"""recreate_messages_and_notifications_tables

Revision ID: 37b13f3f68e4
Revises: 1dc12671825a
Create Date: 2026-03-30 23:16:27.507470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '37b13f3f68e4'
down_revision: Union[str, Sequence[str], None] = '1dc12671825a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum types
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typname='messagestatus') THEN
            CREATE TYPE messagestatus AS ENUM ('PENDING_OFFLINE', 'ONGOING', 'ACCEPTED', 'REJECTED', 'MISSED');
        END IF;
    END$$;
    """)
    
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typname='messagetype') THEN
            CREATE TYPE messagetype AS ENUM ('TEXT', 'FILE', 'SESSION_REQUEST');
        END IF;
    END$$;
    """)
    
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typname='notificationtype') THEN
            CREATE TYPE notificationtype AS ENUM ('BOOKING_REQUESTED', 'BOOKING_APPROVED', 'BOOKING_REJECTED', 'PAYMENT_RECEIVED', 'SESSION_INITIATED', 'SESSION_ACCEPTED', 'SESSION_STARTED', 'SESSION_COMPLETED', 'SESSION_CANCELLED', 'MESSAGE_RECEIVED', 'SYSTEM');
        END IF;
    END$$;
    """)
    
    # Create messages table with raw SQL to avoid enum type conflicts
    op.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type messagetype NOT NULL DEFAULT 'TEXT',
        file_url VARCHAR NULL,
        file_key VARCHAR NULL,
        booking_id UUID NULL REFERENCES bookings(id) ON DELETE SET NULL,
        session_id UUID NULL REFERENCES sessions(id) ON DELETE SET NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMP WITH TIME ZONE NULL,
        status messagestatus NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
    """)
    
    # Create indexes
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='messages' AND indexname='ix_message_sender_receiver') THEN
            CREATE INDEX ix_message_sender_receiver ON messages(sender_id, receiver_id);
        END IF;
    END$$;
    """)
    
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='messages' AND indexname='ix_message_conversation') THEN
            CREATE INDEX ix_message_conversation ON messages(sender_id, receiver_id, created_at);
        END IF;
    END$$;
    """)
    
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='messages' AND indexname='ix_message_receiver_unread') THEN
            CREATE INDEX ix_message_receiver_unread ON messages(receiver_id, is_read);
        END IF;
    END$$;
    """)
    
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='messages' AND indexname='ix_message_created') THEN
            CREATE INDEX ix_message_created ON messages(created_at);
        END IF;
    END$$;
    """)
    
    # Create notifications table
    op.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_type notificationtype NOT NULL,
        title VARCHAR NOT NULL,
        message TEXT NOT NULL,
        booking_id UUID NULL REFERENCES bookings(id) ON DELETE SET NULL,
        session_id UUID NULL REFERENCES sessions(id) ON DELETE SET NULL,
        sender_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        payload JSON NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMP WITH TIME ZONE NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )
    """)
    
    # Create notification indexes
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='notifications' AND indexname='ix_notifications_user_id') THEN
            CREATE INDEX ix_notifications_user_id ON notifications(user_id);
        END IF;
    END$$;
    """)
    
    op.execute("""
    DO $$ 
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE tablename='notifications' AND indexname='ix_notifications_notification_type') THEN
            CREATE INDEX ix_notifications_notification_type ON notifications(notification_type);
        END IF;
    END$$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("DROP TABLE IF EXISTS messages CASCADE")
