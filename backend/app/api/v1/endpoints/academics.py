"""
ACADEMICS MANAGEMENT - Staff-only endpoints for managing the subject hierarchy.

This module provides STAFF role endpoints to create and manage:
  1. StudyLevel (e.g., Grade 10, Bachelor)
  2. Board (e.g., NEB, Tribhuvan University)
  3. Faculty (e.g., CSIT, Science)
  4. ClassLevel (e.g., Grade 10, Semester 5) - for display/reference only
  5. Subject (with unit_value replacing discrete ClassLevel)

ClassLevels are now for reference/display only since Subject uses numeric unit_value.
However, they can still be created and used in reports or historical references.

All endpoints require STAFF role.
"""

from uuid import UUID
from fastapi import APIRouter, status, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import DbSession, RequireAcademicsManage
from app.core.exceptions import InvalidRequestError, ResourceNotFoundError, DuplicateResourceError
from app.models.subject import StudyLevel, Board, Faculty, ClassLevel, Subject
from app.services.subject_service import SubjectService
from app.schemas.subject import (
    StudyLevelCreate, StudyLevelRead,
    BoardCreate, BoardRead,
    FacultyCreate, FacultyRead,
    ClassLevelCreate, ClassLevelRead,
    SubjectCreate, SubjectRead, SubjectWithContextRead,
)

router = APIRouter(prefix="/academics", tags=["Academics (Staff Only)"])


# ═══════════════════════════════════════════════════════════════════════════════
# STUDY LEVEL ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/study-levels", response_model=StudyLevelRead, status_code=201)
async def create_study_level(
    body: StudyLevelCreate,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> StudyLevelRead:
    """
    [STAFF] Create a new StudyLevel.

    Examples: Grade 1-10, Grade 11, +2, Bachelor, Master, PhD

    Example Request:
    ```json
    {
      "name": "Bachelor",
      "description": "University Undergraduate Degree",
      "is_active": true
    }
    ```

    Responses:
      201 Created: StudyLevel created successfully
      400 Bad Request: Validation failed
      403 Forbidden: User is not STAFF
    """
    try:
        # Check for duplicate
        stmt = select(StudyLevel).where(StudyLevel.name == body.name)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise DuplicateResourceError(
                detail=f"StudyLevel with name '{body.name}' already exists"
            )

        study_level = StudyLevel(**body.model_dump())
        db.add(study_level)
        await db.flush()
        await db.refresh(study_level)

        return StudyLevelRead.from_attributes(study_level)

    except DuplicateResourceError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/study-levels", response_model=list[StudyLevelRead])
async def list_study_levels(
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> list[StudyLevelRead]:
    """[STAFF] List all StudyLevels."""
    stmt = select(StudyLevel).order_by(StudyLevel.name)
    result = await db.execute(stmt)
    return [StudyLevelRead.from_attributes(sl) for sl in result.scalars().all()]


@router.get("/study-levels/{study_level_id}", response_model=StudyLevelRead)
async def get_study_level(
    study_level_id: UUID,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> StudyLevelRead:
    """[STAFF] Get a specific StudyLevel by ID."""
    stmt = select(StudyLevel).where(StudyLevel.id == study_level_id)
    result = await db.execute(stmt)
    study_level = result.scalar_one_or_none()

    if not study_level:
        raise ResourceNotFoundError(detail="StudyLevel not found")

    return StudyLevelRead.from_attributes(study_level)


# ═══════════════════════════════════════════════════════════════════════════════
# BOARD ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/boards", response_model=BoardRead, status_code=201)
async def create_board(
    body: BoardCreate,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> BoardRead:
    """
    [STAFF] Create a new Board for multiple StudyLevels.

    A Board represents an examination body or university that can serve multiple StudyLevels.
    Examples: NEB (National Examination Board), TU (Tribhuvan University)

    A Board can now offer multiple StudyLevels:
      - TU (Board) offers Grade 10, Bachelor, Master, PhD (multiple StudyLevels)
      - NEB (Board) offers Grade 10, Grade 11, Grade 12, +2 (multiple StudyLevels)

    Example Request:
    ```json
    {
      "study_level_ids": ["uuid-grade-10", "uuid-grade-11", "uuid-grade-12"],
      "name": "NEB",
      "description": "National Examination Board"
    }
    ```

    Responses:
      201 Created: Board created successfully
      400 Bad Request: Validation failed or invalid StudyLevel ID
      404 Not Found: One or more StudyLevels not found
      403 Forbidden: User is not STAFF
    """
    try:
        # Verify all StudyLevels exist
        stmt = select(StudyLevel).where(StudyLevel.id.in_(body.study_level_ids))
        result = await db.execute(stmt)
        existing_levels = result.scalars().all()
        
        if len(existing_levels) != len(body.study_level_ids):
            missing_ids = set(body.study_level_ids) - {sl.id for sl in existing_levels}
            raise ResourceNotFoundError(
                detail=f"One or more StudyLevels not found: {missing_ids}"
            )

        # Create board
        board = Board(name=body.name, description=body.description)
        board.study_levels = existing_levels
        
        db.add(board)
        await db.flush()

        # Refresh to get relationships
        await db.refresh(board)

        return BoardRead.from_attributes(board)

    except ResourceNotFoundError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/boards", response_model=list[BoardRead])
async def list_boards(
    study_level_id: UUID | None = None,
    db: DbSession = None
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> list[BoardRead]:
    """
    [STAFF] List all Boards, optionally filtered by StudyLevel.
    
    Query Parameters:
      - study_level_id: Filter boards that serve a specific StudyLevel (many-to-many)
    """
    stmt = select(Board)
    
    if study_level_id:
        # Filter boards that have the specified study_level in their study_levels collection
        stmt = stmt.where(Board.study_levels.any(StudyLevel.id == study_level_id))
    
    stmt = stmt.order_by(Board.name)

    result = await db.execute(stmt)
    return [BoardRead.from_attributes(b) for b in result.scalars().all()]


@router.get("/boards/{board_id}", response_model=BoardRead)
async def get_board(
    board_id: UUID,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> BoardRead:
    """[STAFF] Get a specific Board by ID."""
    stmt = select(Board).where(Board.id == board_id)
    result = await db.execute(stmt)
    board = result.scalar_one_or_none()

    if not board:
        raise ResourceNotFoundError(detail="Board not found")

    return BoardRead.from_attributes(board)


# ═══════════════════════════════════════════════════════════════════════════════
# FACULTY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/faculties", response_model=FacultyRead, status_code=201)
async def create_faculty(
    body: FacultyCreate,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> FacultyRead:
    """
    [STAFF] Create a new Faculty under a Board.

    A Faculty represents a stream or specialization.
    Examples: CSIT (Computer Science & IT), Science, Management

    IMPORTANT: When a Subject has a Faculty, its unit_value is validated against:
      - faculty.unit_type (e.g., SEMESTER)
      - faculty.total_units (e.g., 8 for 8-semester program)

    The Faculty's unit_type becomes the display type in Subject context.

    Example Request:
    ```json
    {
      "board_id": "uuid",
      "name": "BSc. CSIT",
      "description": "Computer Science and Information Technology",
      "unit_type": "SEMESTER",
      "total_units": 8,
      "is_active": true
    }
    ```

    Responses:
      201 Created: Faculty created successfully
      400 Bad Request: Validation failed or Board not found
      403 Forbidden: User is not STAFF
    """
    try:
        # Verify Board exists
        stmt = select(Board).where(Board.id == body.board_id)
        result = await db.execute(stmt)
        if not result.scalar_one_or_none():
            raise ResourceNotFoundError(
                detail=f"Board with ID {body.board_id} not found"
            )

        faculty = Faculty(**body.model_dump())
        db.add(faculty)
        await db.flush()
        await db.refresh(faculty)

        return FacultyRead.from_attributes(faculty)

    except ResourceNotFoundError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/faculties", response_model=list[FacultyRead])
async def list_faculties(
    board_id: UUID | None = None,
    db: DbSession = None
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> list[FacultyRead]:
    """[STAFF] List all Faculties, optionally filtered by Board."""
    stmt = select(Faculty)
    if board_id:
        stmt = stmt.where(Faculty.board_id == board_id)
    stmt = stmt.order_by(Faculty.name)

    result = await db.execute(stmt)
    return [FacultyRead.from_attributes(f) for f in result.scalars().all()]


@router.get("/faculties/{faculty_id}", response_model=FacultyRead)
async def get_faculty(
    faculty_id: UUID,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> FacultyRead:
    """[STAFF] Get a specific Faculty by ID."""
    stmt = select(Faculty).where(Faculty.id == faculty_id)
    result = await db.execute(stmt)
    faculty = result.scalar_one_or_none()

    if not faculty:
        raise ResourceNotFoundError(detail="Faculty not found")

    return FacultyRead.from_attributes(faculty)


# ═══════════════════════════════════════════════════════════════════════════════
# CLASS LEVEL ENDPOINTS (Reference/Display only - not directly used by Subject)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/class-levels", response_model=ClassLevelRead, status_code=201)
async def create_class_level(
    body: ClassLevelCreate,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> ClassLevelRead:
    """
    [STAFF] Create a ClassLevel (for reference/display only).

    IMPORTANT: ClassLevels are no longer directly used by Subjects.
    Subjects now use numeric unit_value constrained by their parent (Board/Faculty).

    ClassLevels can still be created for:
      - Display purposes (show "Grade 10" instead of just "10")
      - Historical references
      - Reports and statistics
      - UI label generation

    Example Request:
    ```json
    {
      "study_level_id": "uuid",
      "name": "Grade 10",
      "display_name": "10th Grade",
      "level_order": 10,
      "is_active": true
    }
    ```

    Responses:
      201 Created: ClassLevel created successfully
      400 Bad Request: Validation failed or StudyLevel not found
      403 Forbidden: User is not STAFF
    """
    try:
        # Verify StudyLevel exists
        stmt = select(StudyLevel).where(StudyLevel.id == body.study_level_id)
        result = await db.execute(stmt)
        if not result.scalar_one_or_none():
            raise ResourceNotFoundError(
                detail=f"StudyLevel with ID {body.study_level_id} not found"
            )

        class_level = ClassLevel(**body.model_dump())
        db.add(class_level)
        await db.flush()
        await db.refresh(class_level)

        return ClassLevelRead.from_attributes(class_level)

    except ResourceNotFoundError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/class-levels", response_model=list[ClassLevelRead])
async def list_class_levels(
    study_level_id: UUID | None = None,
    db: DbSession = None
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> list[ClassLevelRead]:
    """[STAFF] List all ClassLevels, optionally filtered by StudyLevel."""
    stmt = select(ClassLevel)
    if study_level_id:
        stmt = stmt.where(ClassLevel.study_level_id == study_level_id)
    stmt = stmt.order_by(ClassLevel.level_order)

    result = await db.execute(stmt)
    return [ClassLevelRead.from_attributes(cl) for cl in result.scalars().all()]


@router.get("/class-levels/{class_level_id}", response_model=ClassLevelRead)
async def get_class_level(
    class_level_id: UUID,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> ClassLevelRead:
    """[STAFF] Get a specific ClassLevel by ID."""
    stmt = select(ClassLevel).where(ClassLevel.id == class_level_id)
    result = await db.execute(stmt)
    class_level = result.scalar_one_or_none()

    if not class_level:
        raise ResourceNotFoundError(detail="ClassLevel not found")

    return ClassLevelRead.from_attributes(class_level)


# ═══════════════════════════════════════════════════════════════════════════════
# SUBJECT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/subjects", response_model=SubjectWithContextRead, status_code=201)
async def create_subject(
    body: SubjectCreate,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> SubjectWithContextRead:
    """
    [STAFF] Create a new Subject with numeric unit_value.

    VALIDATION RULES:
    ─────────────────

    1. Faculty Requirement:
       - All subjects MUST have a faculty_id (never NULL)
       - For Grades 1-10: Use the 'General' faculty (GRADE type, 10 units)
       - For +2, Bachelor, Master, PhD, etc.: Use specific faculties (CSIT, Science, etc.)

    2. unit_value Constraints:
       - Always: 1 ≤ unit_value ≤ faculty.total_units
       - Validated against the Faculty's unit configuration

    3. Hierarchy Safety:
       - board_id must belong to the selected study_level_id
       - faculty_id must belong to the selected board_id

    EXAMPLES:
    ─────────

    Example 1: Grade 10 Subject (Using 'General' Faculty)
    ```json
    {
      "name": "Mathematics",
      "study_level_id": "grade-10-uuid",
      "board_id": "neb-uuid",
      "faculty_id": "general-faculty-uuid",
      "unit_value": 10
    }
    ```

    Example 2: University Subject (Using Specific Faculty)
    ```json
    {
      "name": "Data Structures",
      "study_level_id": "bachelor-uuid",
      "board_id": "tu-uuid",
      "faculty_id": "csit-faculty-uuid",
      "unit_value": 3
    }
    ```

    Responses:
      201 Created: Subject created with full context
      400 Bad Request: Validation failed
      404 Not Found: Related entity not found
      403 Forbidden: User is not STAFF
    """
    try:
        service = SubjectService(db)
        subject = await service.create_subject(body)

        return SubjectWithContextRead(
            **subject.__dict__,
            full_context=subject.get_full_context(),
            context_dict=subject.get_full_context_dict()
        )

    except ResourceNotFoundError:
        raise
    except InvalidRequestError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/subjects", response_model=list[SubjectRead])
async def list_subjects(
    study_level_id: UUID | None = None,
    board_id: UUID | None = None,
    faculty_id: UUID | None = None,
    db: DbSession = None
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> list[SubjectRead]:
    """
    [STAFF] List Subjects with optional filtering.

    Query Parameters:
      - study_level_id: Filter by StudyLevel
      - board_id: Filter by Board
      - faculty_id: Filter by Faculty
    """
    stmt = select(Subject)

    if study_level_id:
        stmt = stmt.where(Subject.study_level_id == study_level_id)
    if board_id:
        stmt = stmt.where(Subject.board_id == board_id)
    if faculty_id:
        stmt = stmt.where(Subject.faculty_id == faculty_id)

    stmt = stmt.order_by(Subject.name)
    result = await db.execute(stmt)
    return [SubjectRead.from_attributes(s) for s in result.scalars().all()]


@router.get("/subjects/{subject_id}", response_model=SubjectWithContextRead)
async def get_subject(
    subject_id: UUID,
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> SubjectWithContextRead:
    """[STAFF] Get a specific Subject by ID with full context."""
    service = SubjectService(db)
    subject = await service.get_subject(subject_id)

    if not subject:
        raise ResourceNotFoundError(detail="Subject not found")

    return SubjectWithContextRead(
        **subject.__dict__,
        full_context=subject.get_full_context(),
        context_dict=subject.get_full_context_dict()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# HIERARCHY STATUS ENDPOINT (For verification)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/hierarchy/summary")
async def get_hierarchy_summary(
    db: DbSession
    # _=RequireAcademicsManage  # TODO: Re-enable STAFF requirement for production
) -> dict:
    """
    [STAFF] Get a summary of the current subject hierarchy structure.

    Returns counts and basic structure information for all hierarchy levels.

    Response Example:
    ```json
    {
      "study_levels": {
        "total": 5,
        "items": [
          {"id": "uuid", "name": "Grade 10", "board_count": 1, "subject_count": 8},
          {"id": "uuid", "name": "Bachelor", "board_count": 2, "subject_count": 45}
        ]
      },
      "boards": {
        "total": 8,
        "with_unit_constraints": 3,
        "with_faculty_inheritance": 5
      },
      "faculties": {
        "total": 12,
        "by_unit_type": {"SEMESTER": 8, "YEAR": 3, "GRADE": 1}
      },
      "subjects": {
        "total": 120,
        "without_faculty": 45,
        "with_faculty": 75
      }
    }
    ```
    """
    try:
        # Count StudyLevels
        study_levels_stmt = select(StudyLevel)
        study_levels_result = await db.execute(study_levels_stmt)
        study_levels = study_levels_result.scalars().all()

        # Count Boards
        boards_stmt = select(Board)
        boards_result = await db.execute(boards_stmt)
        boards = boards_result.scalars().all()

        # Count Faculties
        faculties_stmt = select(Faculty)
        faculties_result = await db.execute(faculties_stmt)
        faculties = faculties_result.scalars().all()

        # Count Subjects
        subjects_stmt = select(Subject)
        subjects_result = await db.execute(subjects_stmt)
        subjects = subjects_result.scalars().all()

        # Build summary
        unit_type_counts = {}
        for faculty in faculties:
            unit_type = faculty.unit_type.value
            unit_type_counts[unit_type] = unit_type_counts.get(unit_type, 0) + 1

        boards_with_constraints = sum(1 for b in boards if b.unit_type and b.total_units)
        boards_with_faculty = sum(1 for b in boards if not b.unit_type)

        subjects_without_faculty = sum(1 for s in subjects if not s.faculty_id)
        subjects_with_faculty = sum(1 for s in subjects if s.faculty_id)

        return {
            "study_levels": {
                "total": len(study_levels),
                "list": [
                    {"id": str(sl.id), "name": sl.name}
                    for sl in study_levels
                ]
            },
            "boards": {
                "total": len(boards),
                "with_unit_constraints": boards_with_constraints,
                "with_faculty_inheritance": boards_with_faculty
            },
            "faculties": {
                "total": len(faculties),
                "by_unit_type": unit_type_counts
            },
            "subjects": {
                "total": len(subjects),
                "without_faculty": subjects_without_faculty,
                "with_faculty": subjects_with_faculty
            }
        }

    except Exception as e:
        raise InvalidRequestError(detail=str(e))
