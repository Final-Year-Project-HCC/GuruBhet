from uuid import UUID
from decimal import Decimal
from pydantic import field_validator

from .base import SharedConfig


class SubjectRead(SharedConfig):

    id: UUID
    name: str
    university_id: UUID
    faculty_id: UUID
    semester_number: int
    class_name: str | None
    is_active: bool
    
    # Commented fields — to be considered later
    # level: StudyLevel
    # board: str | None


class SubjectCreate(SharedConfig):

    name: str
    university_id: UUID
    faculty_id: UUID
    semester_number: int
    class_name: str | None = None
    
    # Commented fields — to be considered later
    # level: StudyLevel
    # board: str | None = None

    @field_validator("semester_number")
    @classmethod
    def semester_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Semester number must be at least 1")
        return v


class TeacherSubjectCreate(SharedConfig):

    subject_id: UUID
    rate_per_session: Decimal
    years_of_experience: int = 0

    @field_validator("rate_per_session")
    @classmethod
    def rate_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Rate per session must be positive")
        return v

    @field_validator("years_of_experience")
    @classmethod
    def exp_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Years of experience cannot be negative")
        return v


class TeacherSubjectRead(SharedConfig):

    teacher_id: UUID
    subject_id: UUID
    rate_per_session: Decimal
    years_of_experience: int
    total_sessions_completed: int
    avg_rating: Decimal
    rating_count: int
    is_active: bool
    subject: SubjectRead


class TeacherSearchResult(SharedConfig):
    """Returned from the student search endpoint."""

    teacher_id: UUID
    subject_id: UUID
    rate_per_session: Decimal
    years_of_experience: int
    avg_rating: Decimal
    rating_count: int
    total_sessions_completed: int
    teacher_name: str
    teacher_headline: str | None
    teacher_avatar_url: str | None
    subject: SubjectRead