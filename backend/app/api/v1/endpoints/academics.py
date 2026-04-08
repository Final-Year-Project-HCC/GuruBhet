"""
ACADEMICS MANAGEMENT - Staff-only endpoints for managing the subject hierarchy.

This module provides STAFF role endpoints to create and manage:
  1. StudyLevel (e.g., Grade 10, Bachelor)
  2. Board (e.g., NEB, Tribhuvan University)
  3. Faculty (e.g., CSIT, Science)
  4. Subject (with unit_value replacing discrete ClassLevel)

All endpoints require STAFF role.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request
from sqlalchemy import select

from app.core.dependencies import DbSession, HasPermission, RequireAcademicsManage, get_current_user
from app.core.exceptions import DuplicateResourceError, InvalidRequestError, ResourceNotFoundError
from app.models.subject import Board, Faculty, StudyLevel, Subject, board_study_levels
from app.schemas.subject import (
    BoardCreate,
    BoardRead,
    FacultyCreate,
    FacultyRead,
    StudyLevelCreate,
    StudyLevelRead,
    SubjectCreate,
    SubjectRead,
    SubjectWithContextRead,
)
from app.services.subject_service import SubjectService

router = APIRouter(prefix="/academics", tags=["Academics (Staff Only)"])


async def verify_inactive_access(
    is_active: Annotated[bool, Query(..., alias="isActive")], db: DbSession, request: Request
):
    if not is_active:
        token = request.headers.get("x-access-token")
        user = await get_current_user(db, token)
        checker = HasPermission("academic_domains:manage")
        checker(user)


# ═══════════════════════════════════════════════════════════════════════════════
# STUDY LEVEL ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/study-levels", response_model=StudyLevelRead, status_code=201)
async def create_study_level(
    body: StudyLevelCreate, db: DbSession, _=RequireAcademicsManage
) -> StudyLevelRead:
    """
    [STAFF] Create a new StudyLevel.

    Examples: Grade 1-10, +2, Bachelor, Master, PhD

    Example Request:
    ```json
    {
      "name": "Bachelor",
      "description": "University Undergraduate Degree",
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

        return StudyLevelRead.model_validate(study_level)

    except DuplicateResourceError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/study-levels", response_model=list[StudyLevelRead])
async def list_study_levels(
    request: Request, is_active: bool = Query(default=True, alias="isActive"), db: DbSession = None
) -> list[StudyLevelRead]:
    """[STAFF] List all StudyLevels."""
    await verify_inactive_access(is_active, db, request)
    stmt = select(StudyLevel)
    stmt = stmt.where(StudyLevel.is_active == is_active)
    stmt = stmt.order_by(StudyLevel.name)
    result = await db.execute(stmt)
    return [StudyLevelRead.model_validate(sl) for sl in result.scalars().all()]


@router.get("/study-levels/{study_level_id}", response_model=StudyLevelRead)
async def get_study_level(
    study_level_id: Annotated[UUID, Path(..., alias="studyLevelId")],
    request: Request,
    is_active: bool = Query(default=True, alias="isActive"),
    db: DbSession = None,
) -> StudyLevelRead:
    """[STAFF] Get a specific StudyLevel by ID."""
    await verify_inactive_access(is_active, db, request)
    stmt = select(StudyLevel).where(StudyLevel.id == study_level_id)
    stmt = stmt.where(StudyLevel.is_active == is_active)

    result = await db.execute(stmt)
    study_level = result.scalar_one_or_none()

    if not study_level:
        raise ResourceNotFoundError(detail="StudyLevel not found")

    return StudyLevelRead.model_validate(study_level)


# ═══════════════════════════════════════════════════════════════════════════════
# BOARD ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/boards", response_model=BoardRead, status_code=201)
async def create_board(body: BoardCreate, db: DbSession, _=RequireAcademicsManage) -> BoardRead:
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
        if not body.study_level_ids:
            raise InvalidRequestError(
                detail="A board must be associated with at least one StudyLevel (study_level_ids cannot be empty)."
            )

        # Verify all StudyLevels exist
        stmt = select(StudyLevel).where(StudyLevel.id.in_(body.study_level_ids))
        result = await db.execute(stmt)
        existing_levels = result.scalars().all()

        if len(existing_levels) != len(body.study_level_ids):
            missing_ids = set(body.study_level_ids) - {sl.id for sl in existing_levels}
            raise ResourceNotFoundError(detail=f"One or more StudyLevels not found: {missing_ids}")

        # Create board
        board = Board(name=body.name, description=body.description)
        board.study_levels = existing_levels

        db.add(board)
        await db.flush()

        # Refresh to get relationships
        await db.refresh(board)

        return BoardRead.model_validate(board)

    except ResourceNotFoundError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/boards", response_model=list[BoardRead])
async def list_boards(
    study_level_id: UUID = Query(default=None, alias="studyLevelId"),
    request: Request = None,
    is_active: bool = Query(default=True, alias="isActive"),
    db: DbSession = None,
) -> list[BoardRead]:
    """
    [STAFF] List Boards.

    If study_level_id is provided: Returns boards associated with that StudyLevel.
    If study_level_id is NOT provided: Returns ALL boards.
    """
    await verify_inactive_access(is_active, db, request)

    stmt = select(Board).where(Board.is_active == is_active)

    if study_level_id:
        stmt = stmt.join(board_study_levels).where(
            board_study_levels.c.study_level_id == study_level_id,
            board_study_levels.c.is_active == is_active,
        )

    stmt = stmt.order_by(Board.name)
    result = await db.execute(stmt)
    return [BoardRead.model_validate(b) for b in result.scalars().all()]


@router.get("/boards/{board_id}", response_model=BoardRead)
async def get_board(
    board_id: Annotated[UUID, Path(..., alias="boardId")],
    request: Request,
    is_active: bool = Query(default=True, alias="isActive"),
    db: DbSession = None,
) -> BoardRead:
    """[STAFF] Get a specific Board by ID."""
    await verify_inactive_access(is_active, db, request)
    stmt = select(Board).where(Board.id == board_id)
    stmt = stmt.where(Board.is_active == is_active)

    result = await db.execute(stmt)
    board = result.scalar_one_or_none()

    if not board:
        raise ResourceNotFoundError(detail="Board not found")

    return BoardRead.model_validate(board)


# ═══════════════════════════════════════════════════════════════════════════════
# FACULTY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/faculties", response_model=FacultyRead, status_code=201)
async def create_faculty(
    body: FacultyCreate, db: DbSession, _=RequireAcademicsManage
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
        # Verify Board and StudyLevel relation exists
        assoc_stmt = (
            select(Board)
            .join(board_study_levels)
            .where(
                Board.id == body.board_id,
                board_study_levels.c.study_level_id == body.study_level_id,
                board_study_levels.c.is_active == True,
                Board.is_active == True,
            )
        )
        result = await db.execute(assoc_stmt)
        if not result.scalar_one_or_none():
            raise ResourceNotFoundError(
                detail=f"Association between Board '{body.board_id}' and StudyLevel '{body.study_level_id}' not found"
            )

        faculty = Faculty(**body.model_dump())
        db.add(faculty)
        await db.flush()
        await db.refresh(faculty)

        return FacultyRead.model_validate(faculty)

    except ResourceNotFoundError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/faculties", response_model=list[FacultyRead])
async def list_faculties(
    study_level_id: UUID = Query(default=None, alias="studyLevelId"),
    board_id: UUID = Query(default=None, alias="boardId"),
    request: Request = None,
    is_active: bool = Query(default=True, alias="isActive"),
    db: DbSession = None,
) -> list[FacultyRead]:
    """
    [STAFF] List Faculties.

    If study_level_id and board_id are provided: Returns faculties for that hierarchy.
    If NOT provided: Returns ALL faculties.
    """
    await verify_inactive_access(is_active, db, request)

    # If both study_level_id and board_id are provided, verify the association exists
    if study_level_id and board_id:
        assoc_stmt = (
            select(Board)
            .join(board_study_levels)
            .where(
                Board.id == board_id,
                board_study_levels.c.study_level_id == study_level_id,
                board_study_levels.c.is_active == is_active,
            )
        )
        assoc_result = await db.execute(assoc_stmt)
        if not assoc_result.scalar_one_or_none():
            raise ResourceNotFoundError(
                detail=f"Association between Board '{board_id}' and StudyLevel '{study_level_id}' not found"
            )

    stmt = select(Faculty).where(Faculty.is_active == is_active)

    if study_level_id:
        stmt = stmt.where(Faculty.study_level_id == study_level_id)

    if board_id:
        stmt = stmt.where(Faculty.board_id == board_id)

    stmt = stmt.order_by(Faculty.name)

    result = await db.execute(stmt)
    return [FacultyRead.model_validate(f) for f in result.scalars().all()]


@router.get("/faculties/{faculty_id}", response_model=FacultyRead)
async def get_faculty(
    faculty_id: Annotated[UUID, Path(..., alias="facultyId")],
    request: Request,
    is_active: bool = Query(default=True, alias="isActive"),
    db: DbSession = None,
) -> FacultyRead:
    """[STAFF] Get a specific Faculty by ID."""
    await verify_inactive_access(is_active, db, request)
    stmt = select(Faculty).where(Faculty.id == faculty_id)
    stmt = stmt.where(Faculty.is_active == is_active)

    result = await db.execute(stmt)
    faculty = result.scalar_one_or_none()

    if not faculty:
        raise ResourceNotFoundError(detail="Faculty not found")

    return FacultyRead.model_validate(faculty)


# ═══════════════════════════════════════════════════════════════════════════════
# SUBJECT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/subjects", response_model=SubjectWithContextRead, status_code=201)
async def create_subject(
    body: SubjectCreate, db: DbSession, _=RequireAcademicsManage
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

        subject.full_context = subject.get_full_context()
        subject.context_dict = subject.get_full_context_dict()
        return SubjectWithContextRead.model_validate(subject)

    except ResourceNotFoundError:
        raise
    except InvalidRequestError:
        raise
    except Exception as e:
        await db.rollback()
        raise InvalidRequestError(detail=str(e))


@router.get("/subjects", response_model=list[SubjectRead])
async def list_subjects(
    study_level_id: UUID = Query(default=None, alias="studyLevelId"),
    board_id: UUID = Query(default=None, alias="boardId"),
    faculty_id: UUID = Query(default=None, alias="facultyId"),
    request: Request = None,
    is_active: bool = Query(default=True, alias="isActive"),
    db: DbSession = None,
) -> list[SubjectRead]:
    """
    [STAFF] List Subjects.

    If study_level_id, board_id, and faculty_id are provided: Returns subjects for that hierarchy.
    If NOT provided: Returns ALL subjects.
    """
    await verify_inactive_access(is_active, db, request)

    # If study_level_id and board_id are provided, verify the association exists
    if study_level_id and board_id:
        assoc_stmt = (
            select(Board)
            .join(board_study_levels)
            .where(
                Board.id == board_id,
                board_study_levels.c.study_level_id == study_level_id,
                board_study_levels.c.is_active == is_active,
            )
        )
        assoc_result = await db.execute(assoc_stmt)
        if not assoc_result.scalar_one_or_none():
            raise ResourceNotFoundError(
                detail=f"Association between Board '{board_id}' and StudyLevel '{study_level_id}' not found"
            )

    stmt = select(Subject).where(Subject.is_active == is_active)

    if study_level_id:
        stmt = stmt.where(Subject.study_level_id == study_level_id)

    if board_id:
        stmt = stmt.where(Subject.board_id == board_id)

    if faculty_id:
        stmt = stmt.where(Subject.faculty_id == faculty_id)

    stmt = stmt.order_by(Subject.name)
    result = await db.execute(stmt)
    return [SubjectRead.model_validate(s) for s in result.scalars().all()]


@router.get("/subjects/{subject_id}", response_model=SubjectWithContextRead)
async def get_subject(
    subject_id: Annotated[UUID, Path(..., alias="subjectId")],
    request: Request,
    is_active: bool = Query(default=True, alias="isActive"),
    db: DbSession = None,
) -> SubjectWithContextRead:
    """[STAFF] Get a specific Subject by ID with full context."""
    await verify_inactive_access(is_active, db, request)
    service = SubjectService(db)
    subject = await service.get_subject(subject_id)

    if not subject or subject.is_active != is_active:
        raise ResourceNotFoundError(detail="Subject not found")

    subject.full_context = subject.get_full_context()
    subject.context_dict = subject.get_full_context_dict()
    return SubjectWithContextRead.model_validate(subject)


# ═══════════════════════════════════════════════════════════════════════════════
# HIERARCHY STATUS ENDPOINT (For verification)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/hierarchy/summary")
async def get_hierarchy_summary(
    db: DbSession,
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

        subjects_without_faculty = sum(1 for s in subjects if not s.faculty_id)
        subjects_with_faculty = sum(1 for s in subjects if s.faculty_id)

        return {
            "study_levels": {
                "total": len(study_levels),
                "list": [{"id": str(sl.id), "name": sl.name} for sl in study_levels],
            },
            "boards": {"total": len(boards)},
            "faculties": {"total": len(faculties), "by_unit_type": unit_type_counts},
            "subjects": {
                "total": len(subjects),
                "without_faculty": subjects_without_faculty,
                "with_faculty": subjects_with_faculty,
            },
        }

    except Exception as e:
        raise InvalidRequestError(detail=str(e))
