"""
Schemas for staff management endpoints.
"""
from uuid import UUID
from datetime import datetime
from pydantic import EmailStr

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

