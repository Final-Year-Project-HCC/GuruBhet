from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.core.enums import ReportReason, ReportStatus, BanStatus


class ReportCreate(BaseModel):
    reported_user_id: UUID
    booking_id: UUID | None = None
    evidence_session_id: UUID | None = None
    reason: ReportReason
    description: str


class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reporter_id: UUID
    reported_user_id: UUID
    booking_id: UUID | None
    reason: ReportReason
    description: str
    status: ReportStatus
    created_at: datetime


class ReportResolve(BaseModel):
    status: ReportStatus
    resolution_notes: str


class BanCreate(BaseModel):
    user_id: UUID
    report_id: UUID | None = None
    reason: str
    is_permanent: bool = False
    expires_at: datetime | None = None
    evidence_recording_url: str | None = None


class BanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    reason: str
    status: BanStatus
    is_permanent: bool
    expires_at: datetime | None
    created_at: datetime