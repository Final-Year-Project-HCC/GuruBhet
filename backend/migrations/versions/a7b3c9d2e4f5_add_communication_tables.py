"""Add communication tables (messages, notifications)

Revision ID: a7b3c9d2e4f5
Revises: 4b6ea5e158b8
Create Date: 2026-03-16 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a7b3c9d2e4f5'
down_revision: Union[str, Sequence[str], None] = '4b6ea5e158b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add communication tables."""
    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('receiver_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_type', sa.Enum('TEXT', 'FILE', name='messagetype'), nullable=False, server_default='TEXT'),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('file_public_id', sa.String(length=255), nullable=True),
        sa.Column('booking_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_message_sender_receiver', 'messages', ['sender_id', 'receiver_id'], unique=False)
    op.create_index('ix_message_conversation', 'messages', ['sender_id', 'receiver_id', 'created_at'], unique=False)
    op.create_index('ix_message_receiver_unread', 'messages', ['receiver_id', 'is_read'], unique=False)
    op.create_index('ix_message_created', 'messages', ['created_at'], unique=False)
    op.create_index(op.f('ix_messages_receiver_id'), 'messages', ['receiver_id'], unique=False)
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)

    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('notification_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('booking_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('payload', postgresql.JSON(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notification_user', 'notifications', ['user_id'], unique=False)
    op.create_index('ix_notification_user_unread', 'notifications', ['user_id', 'is_read'], unique=False)
    op.create_index('ix_notification_user_created', 'notifications', ['user_id', 'created_at'], unique=False)
    op.create_index('ix_notification_type', 'notifications', ['notification_type'], unique=False)
    op.create_index(op.f('ix_notifications_sender_id'), 'notifications', ['sender_id'], unique=False)

    # Create file_metadata table
    op.create_table(
        'file_metadata',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('uploader_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('cloudinary_public_id', sa.String(length=255), nullable=True),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['uploader_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_file_uploader', 'file_metadata', ['uploader_id'], unique=False)
    op.create_index('ix_file_created', 'file_metadata', ['created_at'], unique=False)
    op.create_index(op.f('ix_file_metadata_uploader_id'), 'file_metadata', ['uploader_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - remove communication tables."""
    op.drop_index('ix_file_metadata_uploader_id', table_name='file_metadata')
    op.drop_index('ix_file_created', table_name='file_metadata')
    op.drop_index('ix_file_uploader', table_name='file_metadata')
    op.drop_table('file_metadata')
    
    op.drop_index(op.f('ix_notifications_sender_id'), table_name='notifications')
    op.drop_index('ix_notification_type', table_name='notifications')
    op.drop_index('ix_notification_user_created', table_name='notifications')
    op.drop_index('ix_notification_user_unread', table_name='notifications')
    op.drop_index('ix_notification_user', table_name='notifications')
    op.drop_table('notifications')
    
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_receiver_id'), table_name='messages')
    op.drop_index('ix_message_created', table_name='messages')
    op.drop_index('ix_message_receiver_unread', table_name='messages')
    op.drop_index('ix_message_conversation', table_name='messages')
    op.drop_index('ix_message_sender_receiver', table_name='messages')
    op.drop_table('messages')
