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
    created_at: str
    updated_at: str


class FacultyBase(SharedConfig):

    name: str
    description: str | None = None
    number_of_semesters: int


class FacultyCreate(FacultyBase):
    university_id: UUID


class FacultyRead(FacultyBase):

    id: UUID
    university_id: UUID
    created_at: str
    updated_at: str


class SubjectBase(SharedConfig):

    name: str
    semester_number: int
    class_name: str | None = None
    description: str | None = None

    # Commented fields — to be considered later
    # level: StudyLevel
    # board: str | None = None


class SubjectCreate(SubjectBase):
    university_id: UUID
    faculty_id: UUID

    @field_validator("semester_number")
    @classmethod
    def semester_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Semester number must be at least 1")
        return v


class SubjectRead(SubjectBase):

    id: UUID
    university_id: UUID
    faculty_id: UUID
    is_active: bool
    created_at: str
    updated_at: str
