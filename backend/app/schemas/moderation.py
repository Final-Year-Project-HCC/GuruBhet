from uuid import UUID
from datetime import datetime

from app.core.enums import ReportReason, ReportStatus, BanStatus
from .base import SharedConfig


class ReportCreate(SharedConfig):

    reported_user_id: UUID
    booking_id: UUID | None = None
    evidence_session_id: UUID | None = None
    reason: ReportReason
    description: str


class ReportRead(SharedConfig):

    id: UUID
    reporter_id: UUID
    reported_user_id: UUID
    booking_id: UUID | None
    reason: ReportReason
    description: str
    status: ReportStatus
    created_at: datetime


class ReportResolve(SharedConfig):

    status: ReportStatus
    resolution_notes: str


class BanCreate(SharedConfig):

    user_id: UUID
    report_id: UUID | None = None
    reason: str
    is_permanent: bool = False
    expires_at: datetime | None = None
    evidence_recording_url: str | None = None


class BanRead(SharedConfig):

    id: UUID
    user_id: UUID
    reason: str
    status: BanStatus
    is_permanent: bool
    expires_at: datetime | None
    created_at: datetime