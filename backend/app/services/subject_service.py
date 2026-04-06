"""Service layer for Subject management with cross-level hierarchy validation."""

import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidRequestError, ResourceNotFoundError
from app.models.subject import Subject, StudyLevel, Board, Faculty
from app.schemas.subject import SubjectCreate, SubjectUpdate

logger = logging.getLogger(__name__)


# Study levels that do NOT use faculties (primary and lower secondary education)
# Grades 1-10 don't have faculties. +2, Bachelor, Master, etc. can have faculties.
STUDY_LEVELS_WITHOUT_FACULTY = {
    "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
    "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"
}


class SubjectService:
    """
    Service for managing Subjects with cross-level hierarchy validation.

    Ensures data consistency across the hierarchy:
      1. StudyLevel (e.g., Bachelor, Grade 10)
      2. Board (e.g., TU, NEB)
      3. Faculty (e.g., CSIT) — nullable for Grades 1-10
      4. unit_value (numeric, 1-N, validated against parent's total_units)
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_subject(self, subject_create: SubjectCreate) -> Subject:
        """
        Create a new Subject with comprehensive cross-level validation.

        Args:
            subject_create: SubjectCreate schema with all required/optional fields

        Returns:
            Subject: Newly created Subject object

        Raises:
            InvalidRequestError: If validation fails
            ResourceNotFoundError: If related records don't exist
        """

        # Step 1: Fetch and validate StudyLevel
        study_level = await self._get_study_level(subject_create.study_level_id)
        if not study_level:
            raise ResourceNotFoundError(
                detail=f"StudyLevel with ID {subject_create.study_level_id} not found"
            )

        # Step 2: Fetch and validate Board
        board = await self._get_board(subject_create.board_id)
        if not board:
            raise ResourceNotFoundError(detail=f"Board with ID {subject_create.board_id} not found")

        # Step 3: Validate Board belongs to StudyLevel (many-to-many relationship)
        # Check if the selected study_level is in the board's study_levels
        if subject_create.study_level_id not in {sl.id for sl in board.study_levels}:
            study_level_list = ", ".join([sl.name for sl in board.study_levels])
            raise InvalidRequestError(
                detail=f"Board '{board.name}' does not serve StudyLevel '{study_level.name}'. "
                f"Board serves: {study_level_list}."
            )

        # Step 4: Fetch and validate Faculty (if provided)
        faculty = None
        if subject_create.faculty_id:
            faculty = await self._get_faculty(subject_create.faculty_id)
            if not faculty:
                raise ResourceNotFoundError(
                    detail=f"Faculty with ID {subject_create.faculty_id} not found"
                )

            # Validate Faculty belongs to the selected Board
            if faculty.board_id != subject_create.board_id:
                raise InvalidRequestError(
                    detail=f"Faculty '{faculty.name}' does not belong to Board '{board.name}'. "
                    f"Faculty belongs to '{faculty.board.name}'."
                )

        # Step 5: Validate Faculty is NULL for Grades 1-10, and can be used for others
        self._validate_faculty_for_study_level(study_level, subject_create.faculty_id)

        # Step 6: Validate unit_value against Faculty or Board constraints
        self._validate_unit_value(
            unit_value=subject_create.unit_value,
            faculty=faculty,
            board=board
        )

        # Step 7: Create and persist Subject
        subject = Subject(
            name=subject_create.name.strip(),
            study_level_id=subject_create.study_level_id,
            board_id=subject_create.board_id,
            faculty_id=subject_create.faculty_id,
            unit_value=subject_create.unit_value,
        )

        # Load relationships for eager access
        subject.study_level = study_level
        subject.board = board
        subject.faculty = faculty

        self.db.add(subject)
        await self.db.flush()
        await self.db.refresh(subject)

        logger.info(
            f"Created Subject: {subject.name} "
            f"(StudyLevel: {study_level.name}, Board: {board.name}, "
            f"Faculty: {faculty.name if faculty else 'None'}, "
            f"unit_value: {subject.unit_value})"
        )

        return subject

    async def update_subject(self, subject_id: UUID, subject_update: SubjectUpdate) -> Subject:
        """
        Update a Subject with validation of changed fields.

        Args:
            subject_id: UUID of the subject to update
            subject_update: SubjectUpdate schema with fields to update

        Returns:
            Subject: Updated Subject object

        Raises:
            ResourceNotFoundError: If subject not found
            InvalidRequestError: If validation fails
        """

        subject = await self.get_subject(subject_id)
        if not subject:
            raise ResourceNotFoundError(detail=f"Subject with ID {subject_id} not found")

        # Only validate and update fields that are provided
        if subject_update.name is not None:
            subject.name = subject_update.name.strip()

        if subject_update.board_id is not None:
            board = await self._get_board(subject_update.board_id)
            if not board:
                raise ResourceNotFoundError(detail=f"Board with ID {subject_update.board_id} not found")
            # Validate board serves the subject's study level
            if subject.study_level_id not in {sl.id for sl in board.study_levels}:
                study_level_list = ", ".join([sl.name for sl in board.study_levels])
                raise InvalidRequestError(
                    detail=f"Board '{board.name}' does not serve StudyLevel '{subject.study_level.name}'. "
                    f"Board serves: {study_level_list}."
                )
            subject.board_id = subject_update.board_id
            subject.board = board

        if subject_update.faculty_id is not None or (
            subject_update.faculty_id is None and hasattr(subject_update, "faculty_id")
        ):
            faculty = None
            if subject_update.faculty_id:
                faculty = await self._get_faculty(subject_update.faculty_id)
                if not faculty:
                    raise ResourceNotFoundError(
                        detail=f"Faculty with ID {subject_update.faculty_id} not found"
                    )
                if faculty.board_id != subject.board_id:
                    raise InvalidRequestError(
                        detail=f"Faculty '{faculty.name}' does not belong to Board '{subject.board.name}'."
                    )
            self._validate_faculty_for_study_level(subject.study_level, subject_update.faculty_id)
            subject.faculty_id = subject_update.faculty_id
            subject.faculty = faculty

        if subject_update.unit_value is not None:
            self._validate_unit_value(
                unit_value=subject_update.unit_value,
                faculty=subject.faculty,
                board=subject.board
            )
            subject.unit_value = subject_update.unit_value

        await self.db.flush()
        await self.db.refresh(subject)

        logger.info(f"Updated Subject: {subject.name}")
        return subject

    async def get_subject(self, subject_id: UUID) -> Subject | None:
        """Get a Subject by ID with all relationships loaded."""
        result = await self.db.execute(
            select(Subject).where(Subject.id == subject_id)
        )
        return result.scalar_one_or_none()

    async def get_subjects_by_study_level(self, study_level_id: UUID) -> list[Subject]:
        """Get all Subjects for a specific StudyLevel."""
        result = await self.db.execute(
            select(Subject).where(Subject.study_level_id == study_level_id)
        )
        return list(result.scalars().all())

    async def get_subjects_by_board(self, board_id: UUID) -> list[Subject]:
        """Get all Subjects for a specific Board."""
        result = await self.db.execute(
            select(Subject).where(Subject.board_id == board_id)
        )
        return list(result.scalars().all())

    async def get_subjects_by_faculty(self, faculty_id: UUID) -> list[Subject]:
        """Get all Subjects for a specific Faculty."""
        result = await self.db.execute(
            select(Subject).where(Subject.faculty_id == faculty_id)
        )
        return list(result.scalars().all())

    # ─────────────────────────────────────────────────────────────────────────
    # Private helper methods
    # ─────────────────────────────────────────────────────────────────────────

    async def _get_study_level(self, study_level_id: UUID) -> StudyLevel | None:
        """Fetch StudyLevel by ID."""
        result = await self.db.execute(
            select(StudyLevel).where(StudyLevel.id == study_level_id)
        )
        return result.scalar_one_or_none()

    async def _get_board(self, board_id: UUID) -> Board | None:
        """Fetch Board by ID with StudyLevel relationship eager-loaded."""
        result = await self.db.execute(
            select(Board).where(Board.id == board_id)
        )
        return result.scalar_one_or_none()

    async def _get_faculty(self, faculty_id: UUID) -> Faculty | None:
        """Fetch Faculty by ID with Board relationship eager-loaded."""
        result = await self.db.execute(
            select(Faculty).where(Faculty.id == faculty_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _validate_faculty_for_study_level(
        study_level: StudyLevel, faculty_id: UUID | None
    ) -> None:
        """
        Validate that faculty_id is appropriate for the given study_level.

        Rules:
          - If study_level is Grade 1-10, faculty_id MUST be NULL
          - If study_level is +2, Bachelor, Master, PhD, etc., faculty_id is allowed but not enforced

        Args:
            study_level: The StudyLevel object
            faculty_id: The faculty_id being validated (can be None)

        Raises:
            InvalidRequestError: If validation fails
        """
        if study_level.name in STUDY_LEVELS_WITHOUT_FACULTY:
            if faculty_id is not None:
                raise InvalidRequestError(
                    detail=f"faculty_id must be NULL for '{study_level.name}'. "
                    f"This study level does not use faculties. "
                    f"Faculties are only applicable for higher levels (+2, Bachelor, Master, PhD, etc.)."
                )

    @staticmethod
    def _validate_unit_value(
        unit_value: int,
        faculty: Faculty | None,
        board: Board | None
    ) -> None:
        """
        Validate that unit_value is within the valid range for the parent (Faculty or Board).

        Rules:
          1. unit_value must be >= 1
          2. If faculty is set, unit_value must be <= faculty.total_units
          3. If faculty is None, unit_value must be <= board.total_units

        Args:
            unit_value: The unit value being validated
            faculty: The Faculty object (if any)
            board: The Board object

        Raises:
            InvalidRequestError: If validation fails
        """
        if unit_value < 1:
            raise InvalidRequestError(detail="unit_value must be >= 1")

        # Determine the constraint to validate against
        max_units = None
        context_name = None

        if faculty and faculty.total_units:
            max_units = faculty.total_units
            context_name = f"Faculty '{faculty.name}' ({faculty.unit_type.value})"
        elif board and board.total_units:
            max_units = board.total_units
            context_name = f"Board '{board.name}' ({board.unit_type.value if board.unit_type else 'unknown type'})"

        if max_units and unit_value > max_units:
            raise InvalidRequestError(
                detail=f"unit_value must be between 1 and {max_units} for {context_name}. "
                f"Got {unit_value}."
            )
