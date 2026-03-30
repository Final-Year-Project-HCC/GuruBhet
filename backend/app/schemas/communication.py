"""Schemas for chat messages and notifications."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class MessageCreate(BaseModel):
    """Create a new message."""
    receiver_id: UUID
    content: str = Field(..., min_length=1, max_length=5000)
    booking_id: UUID | None = None
    session_id: UUID | None = None
    message_type: str = "TEXT"
    file_url: str | None = None
    file_key: str | None = None


class MessageRead(BaseModel):
    """Read message details."""
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    content: str
    message_type: str
    file_url: str | None = None
    file_key: str | None = None
    booking_id: UUID | None = None
    session_id: UUID | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationRead(BaseModel):
    """Read notification details."""
    id: UUID
    user_id: UUID
    notification_type: str
    title: str
    message: str
    booking_id: UUID | None = None
    session_id: UUID | None = None
    sender_id: UUID | None = None
    payload: dict | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationRead(BaseModel):
    """Read conversation (for UI listing)."""
    other_user_id: UUID
    other_user_name: str
    other_user_avatar: str | None = None
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0


class UploadSignatureResponse(BaseModel):
    """S3 upload response."""
    upload_url: str  # Pre-signed URL for upload
    file_key: str    # S3 object key
    bucket_name: str
