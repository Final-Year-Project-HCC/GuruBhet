from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator

from app.core.enums import StudyLevel


class SubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    level: StudyLevel
    board: str | None
    university: str | None
    faculty: str | None
    semester: str | None
    class_name: str | None


class SubjectCreate(BaseModel):
    name: str
    level: StudyLevel
    board: str | None = None
    university: str | None = None
    faculty: str | None = None
    semester: str | None = None
    class_name: str | None = None


class TeacherSubjectCreate(BaseModel):
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


class TeacherSubjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    teacher_id: UUID
    subject_id: UUID
    rate_per_session: Decimal
    years_of_experience: int
    total_sessions_completed: int
    avg_rating: Decimal
    rating_count: int
    is_active: bool
    subject: SubjectRead


class TeacherSearchResult(BaseModel):
    """Returned from the student search endpoint."""
    model_config = ConfigDict(from_attributes=True)

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