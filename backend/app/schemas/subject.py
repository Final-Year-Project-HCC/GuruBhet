


from datetime import datetime
from uuid import UUID
from decimal import Decimal
from pydantic import field_validator, BaseModel

from .base import SharedConfig
from app.core.enums import UnitType

class StudyLevelRead(SharedConfig):
    id: UUID
    name: str
    description: str | None = None
    is_active: bool


class StudyLevelCreate(SharedConfig):
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip(): raise ValueError("StudyLevel name cannot be empty")
        return v.strip()
class BoardRead(SharedConfig):
    id: UUID
    name: str
    description: str | None = None
    is_active: bool

class BoardCreate(SharedConfig):
    study_level_ids: list[UUID]
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip(): raise ValueError("Board name cannot be empty")
        return v.strip()
class FacultyRead(SharedConfig):
    id: UUID
    name: str
    board_id: UUID
    study_level_id: UUID
    description: str | None = None
    unit_type: UnitType
    total_units: int
    is_active: bool

class FacultyCreate(SharedConfig):
    board_id: UUID
    study_level_id: UUID
    name: str
    description: str | None = None
    unit_type: UnitType
    total_units: int

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip(): raise ValueError("Faculty name cannot be empty")
        return v.strip()

    @field_validator("total_units")
    @classmethod
    def total_units_valid(cls, v: int) -> int:
        if v < 1: raise ValueError("total_units must be >= 1")
        return v
class SubjectRead(SharedConfig):
    id: UUID
    name: str
    study_level: StudyLevelRead
    board: BoardRead
    is_active: bool
    faculty: FacultyRead
    unit_value: int
    created_at: datetime
    updated_at: datetime

class SubjectCreate(SharedConfig):
    name: str
    study_level_id: UUID
    board_id: UUID
    faculty_id: UUID
    unit_value: int

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip(): raise ValueError("Subject name cannot be empty")
        return v.strip()

    @field_validator("unit_value")
    @classmethod
    def unit_value_valid(cls, v: int) -> int:
        if v < 1: raise ValueError("unit_value must be >= 1")
        return v

class SubjectSearchResponse(SharedConfig):
    id: UUID
    name: str
    unit_value: int
    study_level_name: str
    board_name: str
    faculty_name: str
    unit_type: UnitType

class SubjectUpdate(SharedConfig):
    name: str | None = None
    faculty_id: UUID | None = None
    unit_value: int | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and (not v or not v.strip()): raise ValueError("Subject name cannot be empty")
        return v.strip() if v else None

    @field_validator("unit_value")
    @classmethod
    def unit_value_valid(cls, v: int | None) -> int | None:
        if v is not None and v < 1: raise ValueError("unit_value must be >= 1")
        return v

class SubjectWithContextRead(SharedConfig):
    id: UUID
    name: str
    study_level: StudyLevelRead
    board: BoardRead
    faculty: FacultyRead
    unit_value: int
    full_context: str
    context_dict: dict
    created_at: datetime
    updated_at: datetime

class BulkSubjectCreateRequest(SharedConfig):
    subjects: list[SubjectCreate]

class BulkSubjectCreateResponse(SharedConfig):
    message: str
    count: int

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
    teacher_tagline: str | None
    teacher_avatar_url: str | None
    subject: SubjectRead
