"""Schemas for chat messages and notifications."""
from datetime import datetime
from uuid import UUID

from pydantic import Field
from .base import SharedConfig


class MessageCreate(SharedConfig):
    """Create a new message."""

    receiver_id: UUID
    content: str = Field(..., min_length=1, max_length=5000)
    booking_id: UUID | None = None
    session_id: UUID | None = None
    message_type: str = "TEXT"
    file_url: str | None = None
    file_key: str | None = None


class MessageRead(SharedConfig):
    """Read message details."""

    id: UUID


class NotificationRead(SharedConfig):
    """Read notification details."""

    id: UUID


class ConversationRead(SharedConfig):
    """Read conversation (for UI listing)."""

    other_user_id: UUID
    other_user_name: str
    other_user_avatar: str | None = None
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0


class UploadSignatureResponse(SharedConfig):
    """S3 upload response."""

    upload_url: str  # Pre-signed URL for upload
    file_key: str    # S3 object key
    bucket_name: str
