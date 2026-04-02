from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import field_validator

from app.core.enums import BookingStatus, SessionStatus
from .base import SharedConfig


class BookingRequestCreate(SharedConfig):

    teacher_id: UUID
    subject_id: UUID
    total_sessions: int
    rate_per_session: Decimal
    session_duration_minutes: int  # must be multiple of 15

    @field_validator("total_sessions")
    @classmethod
    def sessions_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Total sessions must be positive")
        return v

    @field_validator("rate_per_session")
    @classmethod
    def rate_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Rate must be positive")
        return v

    @field_validator("session_duration_minutes")
    @classmethod
    def duration_multiple_of_15(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Duration must be positive")
        if v % 15 != 0:
            raise ValueError("Duration must be a multiple of 15 minutes")
        return v


class BookingApproveRequest(SharedConfig):

    notes: str | None = None


class SessionRead(SharedConfig):

    id: UUID
    booking_id: UUID
    session_number: int
    status: SessionStatus
    livekit_room_name: str | None
    teacher_initiated_at: datetime | None
    student_accepted_at: datetime | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    teacher_joined_at: datetime | None
    student_joined_at: datetime | None
    duration_seconds: int | None
    recording_url: str | None
    notes: str | None


class SessionReadWithToken(SharedConfig):

    id: UUID
    booking_id: UUID
    session_number: int
    status: SessionStatus
    livekit_room_name: str | None
    teacher_initiated_at: datetime | None
    student_accepted_at: datetime | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None
    teacher_joined_at: datetime | None
    student_joined_at: datetime | None
    duration_seconds: int | None
    recording_url: str | None
    notes: str | None
    token: str  # LiveKit JWT token
    livekit_url: str  # LiveKit server URL


class BookingRead(SharedConfig):

    id: UUID
    student_id: UUID
    teacher_id: UUID
    subject_id: UUID
    total_sessions: int
    completed_sessions: int
    cancelled_sessions: int
    rate_per_session: Decimal
    session_duration_minutes: int
    total_amount: Decimal
    refunded_amount: Decimal
    status: BookingStatus
    teacher_approved_at: datetime | None
    teacher_approval_notes: str | None
    created_at: datetime
    sessions: list[SessionRead] = []


class BookingCancelRequest(SharedConfig):
    reason: str


class LiveKitTokenResponse(SharedConfig):
    """LiveKit credentials for joining a session."""
    token: str
    room_name: str
    livekit_url: str