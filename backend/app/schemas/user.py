from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

from app.core.enums import UserRole, VerificationStatus


class UserBase(BaseModel):
    first_name: str
    middle_name: str | None = None
    last_name: str
    email: EmailStr
    phone: str | None = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: UserRole
    is_email_verified: bool
    is_active: bool
    is_banned: bool
    created_at: datetime


class StudentProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    bio: str | None
    avatar_url: str | None


class StudentProfileUpdate(BaseModel):
    bio: str | None = None
    avatar_url: str | None = None


class TeacherProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    bio: str | None
    avatar_url: str | None
    headline: str | None
    verification_status: VerificationStatus


class TeacherProfileUpdate(BaseModel):
    bio: str | None = None
    avatar_url: str | None = None
    headline: str | None = None