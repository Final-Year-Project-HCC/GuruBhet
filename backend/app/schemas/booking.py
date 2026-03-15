from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.core.enums import BookingStatus, SessionStatus


class SessionSlot(BaseModel):
    """One session slot when creating a booking."""
    scheduled_at: datetime
    duration_minutes: int

    @field_validator("duration_minutes")
    @classmethod
    def duration_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Duration must be positive")
        return v


class BookingCreate(BaseModel):
    teacher_id: UUID
    subject_id: UUID
    sessions: list[SessionSlot]

    @field_validator("sessions")
    @classmethod
    def at_least_one(cls, v: list[SessionSlot]) -> list[SessionSlot]:
        if not v:
            raise ValueError("At least one session is required")
        return v


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_id: UUID
    session_number: int
    scheduled_at: datetime
    duration_minutes: int
    status: SessionStatus
    livekit_room_name: str | None
    actual_start_at: datetime | None
    actual_end_at: datetime | None


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    student_id: UUID
    teacher_id: UUID
    subject_id: UUID
    total_sessions: int
    completed_sessions: int
    cancelled_sessions: int
    rate_per_session: Decimal
    total_amount: Decimal
    refunded_amount: Decimal
    status: BookingStatus
    created_at: datetime
    sessions: list[SessionRead] = []


class BookingCancelRequest(BaseModel):
    reason: str


class LiveKitTokenResponse(BaseModel):
    token: str
    room_name: str
    livekit_url: str