"""recreate_messages_and_notifications_tables

Revision ID: a335d265bc48
Revises: 1dc12671825a
Create Date: 2026-03-30 23:15:21.263539

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a335d265bc48'
down_revision: Union[str, Sequence[str], None] = '1dc12671825a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Enums should already exist from previous migrations, just create the tables
    
    # Create messages table
    op.create_table('messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('receiver_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_type', sa.Enum('TEXT', 'FILE', 'SESSION_REQUEST', name='messagetype'), nullable=False),
        sa.Column('file_url', sa.String(), nullable=True),
        sa.Column('file_key', sa.String(), nullable=True),
        sa.Column('booking_id', sa.UUID(), nullable=True),
        sa.Column('session_id', sa.UUID(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.Enum('PENDING_OFFLINE', 'ONGOING', 'ACCEPTED', 'REJECTED', 'MISSED', name='messagestatus'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_message_sender_receiver', 'messages', ['sender_id', 'receiver_id'])
    op.create_index('ix_message_conversation', 'messages', ['sender_id', 'receiver_id', 'created_at'])
    op.create_index('ix_message_receiver_unread', 'messages', ['receiver_id', 'is_read'])
    op.create_index('ix_message_created', 'messages', ['created_at'])
    
    # Create notifications table
    op.create_table('notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('notification_type', sa.Enum('BOOKING_REQUESTED', 'BOOKING_APPROVED', 'BOOKING_REJECTED', 'PAYMENT_RECEIVED', 'SESSION_INITIATED', 'SESSION_ACCEPTED', 'SESSION_STARTED', 'SESSION_COMPLETED', 'SESSION_CANCELLED', 'MESSAGE_RECEIVED', 'SYSTEM', name='notificationtype'), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('booking_id', sa.UUID(), nullable=True),
        sa.Column('session_id', sa.UUID(), nullable=True),
        sa.Column('sender_id', sa.UUID(), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_notification_type', 'notifications', ['notification_type'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_notifications_notification_type', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')
    op.drop_index('ix_message_created', table_name='messages')
    op.drop_index('ix_message_receiver_unread', table_name='messages')
    op.drop_index('ix_message_conversation', table_name='messages')
    op.drop_index('ix_message_sender_receiver', table_name='messages')
    op.drop_table('messages')
    op.execute("DROP TYPE notificationtype")
    op.execute("DROP TYPE messagestatus")
    op.execute("DROP TYPE messagetype")
