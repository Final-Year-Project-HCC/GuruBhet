from datetime import datetime
from uuid import UUID
from decimal import Decimal
from pydantic import field_validator

from .base import SharedConfig
from app.core.enums import UnitType


# ═══════════════════════════════════════════════════════════════════════════════
# SUPPORTING MODELS (Read-only, used in Subject responses)
# ═══════════════════════════════════════════════════════════════════════════════

class StudyLevelRead(SharedConfig):
    """Minimal StudyLevel representation in API responses."""
    id: UUID
    name: str
    description: str | None = None


class BoardRead(SharedConfig):
    """Minimal Board representation in API responses."""
    id: UUID
    name: str
    study_levels: list[StudyLevelRead]
    description: str | None = None


class FacultyRead(SharedConfig):
    """Minimal Faculty representation in API responses."""
    id: UUID
    name: str
    board: BoardRead
    description: str | None = None
    unit_type: UnitType
    total_units: int


# ═══════════════════════════════════════════════════════════════════════════════
# CREATE SCHEMAS (For Admin/Staff CRUD operations)
# ═══════════════════════════════════════════════════════════════════════════════

class StudyLevelCreate(SharedConfig):
    """Request schema for creating a StudyLevel."""
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("StudyLevel name cannot be empty")
        return v.strip()


class BoardCreate(SharedConfig):
    """Request schema for creating a Board."""
    study_level_ids: list[UUID]
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Board name cannot be empty")
        return v.strip()


class FacultyCreate(SharedConfig):
    """Request schema for creating a Faculty."""
    board_id: UUID
    name: str
    description: str | None = None
    unit_type: UnitType
    total_units: int

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Faculty name cannot be empty")
        return v.strip()

    @field_validator("total_units")
    @classmethod
    def total_units_valid(cls, v: int) -> int:
        if v < 1:
            raise ValueError("total_units must be >= 1")
        return v


class ClassLevelCreate(SharedConfig):
    """Request schema for creating a ClassLevel (for display/reference only)."""
    study_level_id: UUID
    name: str
    display_name: str | None = None
    level_order: int

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("ClassLevel name cannot be empty")
        return v.strip()

    @field_validator("level_order")
    @classmethod
    def level_order_valid(cls, v: int) -> int:
        if v < 1:
            raise ValueError("level_order must be >= 1")
        return v


class ClassLevelRead(SharedConfig):
    """Minimal ClassLevel representation (reference/display only)."""
    id: UUID
    study_level: StudyLevelRead
    name: str
    display_name: str | None = None
    level_order: int


# ═══════════════════════════════════════════════════════════════════════════════
# SUBJECT SCHEMAS (Main)
# ═══════════════════════════════════════════════════════════════════════════════

class SubjectRead(SharedConfig):
    """
    Complete Subject representation with 4-level hierarchy + numeric unit_value.
    Faculty is always present (including 'General' for Grades 1-10).
    Used for API GET responses.
    """

    id: UUID
    name: str
    study_level: StudyLevelRead
    board: BoardRead
    faculty: FacultyRead
    unit_value: int
    created_at: datetime
    updated_at: datetime


class SubjectCreate(SharedConfig):
    """
    Request schema for creating a new Subject.

    Validation rules:
      - study_level_id: Required (FK to StudyLevel)
      - board_id: Required (FK to Board). Must belong to the selected study_level_id.
      - faculty_id: ALWAYS REQUIRED (FK to Faculty)
        * For Grades 1-10: Use the 'General' faculty (automatically created)
        * For +2, Bachelor, Master, PhD, etc.: Use specific faculties (CSIT, Science, etc.)
        * Must belong to the selected board_id
      - unit_value: Required (Integer, 1-N)
        * Validated against Faculty.total_units
    """

    name: str
    study_level_id: UUID
    board_id: UUID
    faculty_id: UUID
    unit_value: int

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """Ensure subject name is not empty."""
        if not v or not v.strip():
            raise ValueError("Subject name cannot be empty")
        return v.strip()

    @field_validator("unit_value")
    @classmethod
    def unit_value_valid(cls, v: int) -> int:
        """Ensure unit_value is >= 1."""
        if v < 1:
            raise ValueError("unit_value must be >= 1")
        return v


class SubjectUpdate(SharedConfig):
    """
    Request schema for updating a Subject.
    All fields are optional.
    """

    name: str | None = None
    board_id: UUID | None = None
    faculty_id: UUID | None = None
    unit_value: int | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        """Ensure subject name is not empty if provided."""
        if v is not None and (not v or not v.strip()):
            raise ValueError("Subject name cannot be empty")
        return v.strip() if v else None

    @field_validator("unit_value")
    @classmethod
    def unit_value_valid(cls, v: int | None) -> int | None:
        """Ensure unit_value is >= 1 if provided."""
        if v is not None and v < 1:
            raise ValueError("unit_value must be >= 1")
        return v


class SubjectWithContextRead(SharedConfig):
    """
    Extended Subject representation with additional context.
    Includes string representations of the full hierarchy and unit type info.
    Faculty is always present.
    """

    id: UUID
    name: str
    study_level: StudyLevelRead
    board: BoardRead
    faculty: FacultyRead
    unit_value: int
    # Full context as formatted strings
    full_context: str  # e.g., "Bachelor > TU > CSIT > Semester 5"
    context_dict: dict  # e.g., {"study_level": "Bachelor", "board": "TU", "unit_type": "SEMESTER", ...}
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════════════════════════════
# BULK OPERATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class BulkSubjectCreateRequest(SharedConfig):
    """Request schema for bulk creating subjects."""
    subjects: list[SubjectCreate]


class BulkSubjectCreateResponse(SharedConfig):
    """Response schema for bulk subject creation."""
    created_count: int
    failed_count: int
    created_subjects: list[SubjectRead] = []
    errors: list[dict] = []


# ═══════════════════════════════════════════════════════════════════════════════
# TEACHER SUBJECT (unchanged, kept for reference)
# ═══════════════════════════════════════════════════════════════════════════════

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