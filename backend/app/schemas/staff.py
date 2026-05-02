"""
Schemas for staff management endpoints.
"""
from typing import Literal
from uuid import UUID
from datetime import datetime
from pydantic import EmailStr, model_validator

from app.core.enums import DocumentType, VerificationStatus
from .base import SharedConfig


class StaffInviteSchema(SharedConfig):
    email: EmailStr
    permissions: list[str] = []

class StaffAcceptInviteSchema(SharedConfig):
    token: str
    first_name: str
    last_name: str
    password: str

class StaffUpdateSchema(SharedConfig):
    permissions: list[str] | None = None
    is_active: bool | None = None

class StaffRead(SharedConfig):
    id: UUID
    first_name: str
    last_name: str
    email: EmailStr
    permissions: list[str]
    is_active: bool
    is_superuser: bool

class AuditLogRead(SharedConfig):
    id: UUID
    action_type: str
    description: str | None
    actor_id: UUID
    target_user_id: UUID | None
    created_at: datetime


# ── Staff-only teacher verification views ────────────────────────────────────

class TeacherPendingOverview(SharedConfig):
    """Lightweight row returned in the paginated pending-teacher list."""
    user_id: UUID
    first_name: str
    middle_name: str | None = None
    last_name: str
    email: EmailStr
    avatar_url: str | None = None
    created_at: datetime


class TeacherDocumentVerificationRead(SharedConfig):
    id: UUID
    type: DocumentType
    file_url: str
    created_at: datetime


class TeacherProfileForVerificationRead(SharedConfig):
    user_id: UUID
    bio: str | None = None
    tagline: str | None = None
    document_status: VerificationStatus
    reviewed_by_id: UUID | None = None
    reviewed_at: datetime | None = None
    remarks: str | None = None
    created_at: datetime
    user: "UserRead"
    documents: list[TeacherDocumentVerificationRead] = []


class TeacherVerificationDecision(SharedConfig):
    action: Literal[VerificationStatus.APPROVED, VerificationStatus.REJECTED]
    remarks: str | None = None

    @model_validator(mode="after")
    def remarks_required_on_reject(self) -> "TeacherVerificationDecision":
        if self.action == VerificationStatus.REJECTED and not (self.remarks and self.remarks.strip()):
            raise ValueError("remarks are required when rejecting a teacher profile")
        return self


# Deferred import to avoid circular dependency (user.py does not import staff.py)
from app.schemas.user import UserRead  # noqa: E402
TeacherProfileForVerificationRead.model_rebuild()
TeacherPendingOverview.model_rebuild()

