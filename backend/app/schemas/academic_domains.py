from datetime import datetime
from uuid import UUID
from pydantic import field_validator

from .base import SharedConfig


class UniversityBase(SharedConfig):

    name: str
    description: str | None = None


class UniversityCreate(UniversityBase):
    pass


class UniversityRead(UniversityBase):

    id: UUID
    created_at: datetime
    updated_at: datetime


class FacultyBase(SharedConfig):

    name: str
    description: str | None = None
    number_of_semesters: int


class FacultyCreate(FacultyBase):
    university_id: UUID


class FacultyRead(FacultyBase):

    id: UUID
    university_id: UUID
    created_at: datetime
    updated_at: datetime


class BulkFacultyCreateRequest(SharedConfig):
    """Schema for bulk faculty creation requests."""
    faculties: list[FacultyCreate]


