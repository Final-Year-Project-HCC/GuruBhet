from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import field_validator, computed_field, model_validator

from app.core.enums import BookingStatus, SessionStatus
from .base import SharedConfig
from .subject import SubjectRead


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
    recording_url: str | None
    notes: str | None

    @computed_field  # type: ignore[misc]
    @property
    def duration_seconds(self) -> int | None:
        """Calculate duration in seconds from actual start and end times."""
        if self.actual_start_at and self.actual_end_at:
            delta = self.actual_end_at - self.actual_start_at
            return int(delta.total_seconds())
        return None


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
    recording_url: str | None
    notes: str | None
    token: str  # LiveKit JWT token
    livekit_url: str  # LiveKit server URL

    @computed_field  # type: ignore[misc]
    @property
    def duration_seconds(self) -> int | None:
        """Calculate duration in seconds from actual start and end times."""
        if self.actual_start_at and self.actual_end_at:
            delta = self.actual_end_at - self.actual_start_at
            return int(delta.total_seconds())
        return None


class StudentInBooking(SharedConfig):
    """Minimal student details included in booking responses."""
    id: UUID
    first_name: str
    last_name: str
    profile_picture_url: str | None = None

    @model_validator(mode='before')
    @classmethod
    def extract_from_student_profile(cls, data):
        """Transform StudentProfile ORM object to dict with correct field mapping."""
        # If data is a StudentProfile ORM object with a user relationship
        if hasattr(data, 'user') and data.user:
            return {
                'id': data.user_id,
                'first_name': data.user.first_name,
                'last_name': data.user.last_name,
                'profile_picture_url': data.avatar_url,
            }
        return data


class TeacherInBooking(SharedConfig):
    """Minimal teacher details included in booking responses."""
    id: UUID
    first_name: str
    last_name: str
    profile_picture_url: str | None = None

    @model_validator(mode='before')
    @classmethod
    def extract_from_teacher_profile(cls, data):
        """Transform TeacherProfile ORM object to dict with correct field mapping."""
        # If data is a TeacherProfile ORM object with a user relationship
        if hasattr(data, 'user') and data.user:
            return {
                'id': data.user_id,
                'first_name': data.user.first_name,
                'last_name': data.user.last_name,
                'profile_picture_url': data.avatar_url,
            }
        return data


class BookingRead(SharedConfig):
    """Generic booking response with only IDs for related entities."""
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
    created_at: datetime


class BookingDetailedReadForStudent(SharedConfig):
    """Booking response for students: includes teacher and subject details."""
    id: UUID
    student_id: UUID
    teacher_id: UUID
    teacher: TeacherInBooking
    subject_id: UUID
    subject: SubjectRead
    total_sessions: int
    completed_sessions: int
    cancelled_sessions: int
    rate_per_session: Decimal
    session_duration_minutes: int
    total_amount: Decimal
    refunded_amount: Decimal
    status: BookingStatus
    teacher_approved_at: datetime | None
    created_at: datetime
    sessions: list[SessionRead] = []


class BookingDetailedReadForTeacher(SharedConfig):
    """Booking response for teachers: includes student and subject details."""
    id: UUID
    student_id: UUID
    student: StudentInBooking
    teacher_id: UUID
    subject_id: UUID
    subject: SubjectRead
    total_sessions: int
    completed_sessions: int
    cancelled_sessions: int
    rate_per_session: Decimal
    session_duration_minutes: int
    total_amount: Decimal
    refunded_amount: Decimal
    status: BookingStatus
    teacher_approved_at: datetime | None
    created_at: datetime
    sessions: list[SessionRead] = []


class BookingCancelRequest(SharedConfig):
    reason: str


class LiveKitTokenResponse(SharedConfig):
    """LiveKit credentials for joining a session."""
    token: str
    room_name: str
    livekit_url: str