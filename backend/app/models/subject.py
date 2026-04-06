import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, ForeignKey, Integer, func, Enum as SQLEnum, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin
from app.core.enums import UnitType


# ═══════════════════════════════════════════════════════════════════════════════
# ASSOCIATION TABLE: Board <-> StudyLevel (Many-to-Many)
# ═══════════════════════════════════════════════════════════════════════════════

board_study_levels = Table(
    'board_study_levels',
    Base.metadata,
    Column('board_id', UUID(as_uuid=True), ForeignKey('boards.id', ondelete='CASCADE'), primary_key=True),
    Column('study_level_id', UUID(as_uuid=True), ForeignKey('study_levels.id', ondelete='CASCADE'), primary_key=True)
)



# ═══════════════════════════════════════════════════════════════════════════════
# LEVEL 1: Study Level (e.g., "10", "11", "12", "+2", "Bachelor", "Master")
# ═══════════════════════════════════════════════════════════════════════════════

class StudyLevel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Level 1 Hierarchy: Study Level (Education Stage).
    Examples: Grade 10, Grade 11, Grade 12, +2, Bachelor, Master, PhD
    """

    __tablename__ = "study_levels"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="study_level", lazy="noload"
    )
    boards: Mapped[list["Board"]] = relationship(
        secondary=board_study_levels,
        back_populates="study_levels",
        lazy="noload"
    )
    class_levels: Mapped[list["ClassLevel"]] = relationship(
        back_populates="study_level", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<StudyLevel {self.name}>"


# ═══════════════════════════════════════════════════════════════════════════════
# CLASS LEVEL (Reference/Display Level within a StudyLevel)
# ═══════════════════════════════════════════════════════════════════════════════

class ClassLevel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Class Level: Display/reference name for a specific unit within a StudyLevel.
    Examples: "Grade 10", "Semester 5", "Year 2", etc.
    
    NOTE: ClassLevels are for reference and display purposes only.
    Subjects use numeric unit_value instead of discrete ClassLevel references.
    
    This model can be used for:
      - UI label generation (show "Grade 10" instead of just "10")
      - Reports and statistics
      - Historical references
      - Display formatting
    """

    __tablename__ = "class_levels"

    study_level_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("study_levels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    level_order: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    study_level: Mapped["StudyLevel"] = relationship(back_populates="class_levels", lazy="joined")

    def __repr__(self) -> str:
        return f"<ClassLevel {self.display_name or self.name} (StudyLevel: {self.study_level.name if self.study_level else 'N/A'})>"




class Board(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Level 2 Hierarchy: Board/University.
    Examples: NEB (National Examination Board), TU (Tribhuvan University),
    KU (Kathmandu University), etc.
    
    Relationship to StudyLevel: Many-to-Many
      - A Board can serve multiple StudyLevels (e.g., TU offers Bachelor, Master, PhD)
      - A StudyLevel can have multiple Boards (e.g., Bachelor offered by TU, KU, Purbanchal)
      - Relationship managed through board_study_levels junction table
    
    Note: Unit structure is always defined by Faculty (including a 'General' faculty
    for Grades 1-10). Board no longer stores unit constraints directly.
    """

    __tablename__ = "boards"

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    study_levels: Mapped[list["StudyLevel"]] = relationship(
        secondary=board_study_levels,
        back_populates="boards",
        lazy="noload"
    )
    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="board", lazy="noload"
    )
    faculties: Mapped[list["Faculty"]] = relationship(
        back_populates="board", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Board {self.name}>"


# ═══════════════════════════════════════════════════════════════════════════════
# LEVEL 3: Faculty (e.g., "Science", "CSIT", "Management", "Law")
# ═══════════════════════════════════════════════════════════════════════════════

class Faculty(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Level 3 Hierarchy: Faculty/Stream.
    Examples: Science, CSIT (Computer Science & IT), Management, Law, Nursing, General, etc.
    
    Relationship to Board: Many-to-One
      - A Faculty belongs to a specific Board
      - A Board can have multiple Faculties
    
    unit_type & total_units:
      - Specifies the granularity and scope for Subjects under this Faculty
      - Example: BSc. CSIT (Faculty) has unit_type=SEMESTER, total_units=8
      - Example: Grade 10 > NEB uses 'General' Faculty with unit_type=GRADE, total_units=10
      - All subjects validate unit_value against their Faculty's total_units
    
    NOTE: Every Board has at least one Faculty (e.g., 'General' for Grades 1-10)
      - This ensures a uniform hierarchy: StudyLevel → Board → Faculty → Subject
      - No special cases or NULL handling needed
    """

    __tablename__ = "faculties"

    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Unit structure (required if subject uses this faculty)
    unit_type: Mapped[UnitType] = mapped_column(
        SQLEnum(UnitType),
        nullable=False,
        comment="GRADE, SEMESTER, or YEAR"
    )
    total_units: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total count (e.g., 8 for 8 semesters in BSc. CSIT)"
    )


    # ── Relationships ─────────────────────────────────────────────────────────
    board: Mapped["Board"] = relationship(back_populates="faculties", lazy="joined")
    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="faculty", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<Faculty {self.name} (Board: {self.board.name if self.board else 'N/A'})>"


# ═══════════════════════════════════════════════════════════════════════════════
# SUBJECT MODEL (The "Leaf" of the Hierarchy)
# ═══════════════════════════════════════════════════════════════════════════════

class Subject(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Normalised subject catalog with uniform 4-level hierarchy + numeric unit_value.

    A Subject is uniquely identified by the combination of:
      1. StudyLevel (e.g., Grade 10, +2, Bachelor, Master)
      2. Board (e.g., NEB, Tribhuvan University)
      3. Faculty (e.g., General, CSIT, Science) — always present, never NULL
      4. unit_value (e.g., 10 for Grade 10, 5 for Semester 5)

    Subjects are seeded by admins; teachers reference them via TeacherSubject.

    Design:
      - Uses foreign keys to StudyLevel, Board, Faculty instead of ENUMs
      - Faculty is ALWAYS required (including 'General' faculty for Grades 1-10)
      - unit_value is validated against Faculty.total_units
      - Hard delete only (no soft-delete) for deprecated subjects
      - Uniform structure eliminates special cases and NULL handling
    """

    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    # ── Level 1: Study Level (Required) ───────────────────────────────────────
    study_level_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("study_levels.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # ── Level 2: Board (Required) ─────────────────────────────────────────────
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # ── Level 3: Faculty (Required) ───────────────────────────────────────
    # Always required. For Grades 1-10, use the 'General' faculty.
    # For higher levels (+2, Bachelor, etc.), use specific faculties (CSIT, Science, etc.)
    faculty_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("faculties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # ── Level 4: Numeric Unit Value ───────────────────────────────────────────
    # Replaces discrete ClassLevel reference with a numeric value
    # Validated against Faculty.total_units
    # Examples:
    #   - Grade 10 (General faculty): unit_value=10, validated against Faculty.total_units (10)
    #   - Semester 5 (CSIT faculty): unit_value=5, validated against Faculty.total_units (8)
    unit_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
        comment="Numeric grade/semester/year (1-N, validated against faculty's total_units)"
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    study_level: Mapped["StudyLevel"] = relationship(back_populates="subjects", lazy="joined")
    board: Mapped["Board"] = relationship(back_populates="subjects", lazy="joined")
    faculty: Mapped["Faculty"] = relationship(back_populates="subjects", lazy="joined")
    teacher_subjects: Mapped[list["TeacherSubject"]] = relationship(  # noqa: F821
        back_populates="subject", lazy="noload"
    )

    # ── Validation ────────────────────────────────────────────────────────────

    @validates("unit_value")
    def validate_unit_value(self, key: str, unit_value: int) -> int:
        """
        Validates that unit_value is within the valid range for the Faculty.
        
        Rules:
          1. unit_value must be >= 1
          2. unit_value must be <= faculty.total_units
        """
        if unit_value is None:
            raise ValueError("unit_value cannot be NULL")
        
        if unit_value < 1:
            raise ValueError("unit_value must be >= 1")
        
        # Validate against faculty's total_units
        if self.faculty and self.faculty.total_units:
            max_units = self.faculty.total_units
            if unit_value > max_units:
                raise ValueError(
                    f"unit_value must be between 1 and {max_units} "
                    f"for Faculty '{self.faculty.name}'. Got {unit_value}."
                )
        
        return unit_value

    def get_full_context(self) -> str:
        """
        Returns a formatted string representing the full hierarchical context of the subject.

        Format examples:
          - "Bachelor > Tribhuvan University > CSIT > Semester 5"
          - "Grade 10 > NEB > General > Grade 10"

        Returns:
            str: Hierarchical context string
        """
        study_level_name = self.study_level.name if self.study_level else "Unknown StudyLevel"
        board_name = self.board.name if self.board else "Unknown Board"
        faculty_name = self.faculty.name if self.faculty else "Unknown Faculty"
        unit_type_str = self.faculty.unit_type.value if self.faculty and self.faculty.unit_type else "Unit"
        
        return f"{study_level_name} > {board_name} > {faculty_name} > {unit_type_str} {self.unit_value}"

    def get_full_context_dict(self) -> dict:
        """
        Returns a dictionary with the full hierarchy context.

        Returns:
            dict: Keys are 'study_level', 'board', 'faculty', 'unit_value', 'unit_type', 'total_units'
        """
        return {
            "study_level": self.study_level.name if self.study_level else None,
            "board": self.board.name if self.board else None,
            "faculty": self.faculty.name if self.faculty else None,
            "unit_value": self.unit_value,
            "unit_type": self.faculty.unit_type.value if self.faculty and self.faculty.unit_type else None,
            "total_units": self.faculty.total_units if self.faculty else None,
        }

    def __repr__(self) -> str:
        return f"<Subject {self.name} ({self.get_full_context()})>"