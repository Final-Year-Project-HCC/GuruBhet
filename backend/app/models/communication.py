"""Chat messages and notifications models."""
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Index, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.db.base import Base, TimestampMixin


class MessageType(str, Enum):
    """Type of message content."""
    TEXT = "TEXT"
    FILE = "FILE"
    SESSION_REQUEST = "SESSION_REQUEST"  # Teacher initiated a session request

class MessageStatus(str, Enum):
    """Status of session request messages (SESSION_REQUEST type only)."""
    PENDING_OFFLINE = "PENDING_OFFLINE"    # Case 1: Student offline when teacher initiated request
    ONGOING = "ONGOING"                    # Case 2-4: Initial state after session request created
    ACCEPTED = "ACCEPTED"                  # Case 2: Student accepted within 60s window
    REJECTED = "REJECTED"                  # Case 3: Student explicitly rejected within 60s window
    MISSED = "MISSED"                      # Case 4: Student missed (timeout at 60s with no action)


class Message(Base, TimestampMixin):
    """Chat message between two users."""
    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    sender_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    receiver_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[MessageType] = mapped_column(default=MessageType.TEXT, nullable=False)
    
    # File metadata (if message_type == FILE)
    file_url: Mapped[str | None] = mapped_column(nullable=True)  # S3 URL
    file_key: Mapped[str | None] = mapped_column(nullable=True)  # S3 object key for deletion
    
    # Related entities (optional)
    booking_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    session_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True)
    
    # Read status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)
    
    # Session request status (for SESSION_REQUEST message_type)
    # Tracks the four cases: PENDING_OFFLINE (offline), ONGOING (initial), ACCEPTED, REJECTED, MISSED (timeout)
    status: Mapped[MessageStatus | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_message_sender_receiver", "sender_id", "receiver_id"),
        Index("ix_message_conversation", "sender_id", "receiver_id", "created_at"),
        Index("ix_message_receiver_unread", "receiver_id", "is_read"),
        Index("ix_message_created", "created_at"),
    )


class NotificationType(str, Enum):
    """Type of notification."""
    BOOKING_REQUESTED = "BOOKING_REQUESTED"
    BOOKING_APPROVED = "BOOKING_APPROVED"
    BOOKING_REJECTED = "BOOKING_REJECTED"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    SESSION_INITIATED = "SESSION_INITIATED"
    SESSION_ACCEPTED = "SESSION_ACCEPTED"
    SESSION_STARTED = "SESSION_STARTED"
    SESSION_COMPLETED = "SESSION_COMPLETED"
    SESSION_CANCELLED = "SESSION_CANCELLED"
    MESSAGE_RECEIVED = "MESSAGE_RECEIVED"
    SYSTEM = "SYSTEM"


class Notification(Base, TimestampMixin):
    """Real-time and persistent notifications."""
    __tablename__ = "notifications"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    notification_type: Mapped[NotificationType] = mapped_column(nullable=False, index=True)
    title: Mapped[str] = mapped_column(nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Related entities for context
    booking_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    session_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True)
    sender_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # JSON payload for flexible data storage
    payload: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    # Read status
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(nullable=True)

    __table_args__ = (
        Index("ix_notification_user_created", "user_id", "created_at"),
        Index("ix_notification_type", "notification_type"),
        Index("ix_notification_unread", "user_id", "is_read"),
        Index("ix_notification_booking", "booking_id"),
        Index("ix_notification_session", "session_id"),
    )
