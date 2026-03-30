"""
Schemas for admin management endpoints.
"""
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.core.enums import AdminRole, AuditActionType


class AdminCreateRequest(BaseModel):
    """Request to create a new admin staff member."""

    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    password: str
    admin_role: str  # AdminRole value


class AdminUpdateRequest(BaseModel):
    """Request to update an admin's role or status."""

    admin_role: str | None = None  # AdminRole value
    is_active: bool | None = None


class AdminRead(BaseModel):
    """Admin user details."""

    id: UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None
    is_staff: bool
    admin_role: AdminRole | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogRead(BaseModel):
    """Audit log entry details."""

    id: UUID
    action_type: AuditActionType
    description: str | None
    actor_id: UUID
    target_user_id: UUID | None
    target_resource_type: str | None
    target_resource_id: UUID | None
    ip_address: str | None
    user_agent: str | None
    metadata: dict | None
    created_at: datetime

    class Config:
        from_attributes = True
