from uuid import UUID
from fastapi import APIRouter, Query, HTTPException
from sqlalchemy import select

from app.core.dependencies import DbSession
from app.models.university import University
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.schemas.subject import SubjectRead, SubjectCreate

router = APIRouter()


@router.get("/", response_model=list[SubjectRead])
async def list_subjects(
    db: DbSession,
    search: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List or search the subject catalog. Public endpoint."""
    stmt = select(Subject).where(Subject.is_active.is_(True))
    if search:
        stmt = stmt.where(Subject.name.ilike(f"%{search}%"))
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/", response_model=SubjectRead, status_code=201)
async def create_subject(body: SubjectCreate, db: DbSession):
    """Add a new subject to the catalog."""
    subject = Subject(**body.model_dump())
    db.add(subject)
    await db.flush()
    await db.commit()
    await db.refresh(subject)
    return subject


@router.get("/{subject_id}", response_model=SubjectRead)
async def get_subject(subject_id: UUID, db: DbSession):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.delete("/{subject_id}", status_code=204)
async def deactivate_subject(subject_id: UUID, db: DbSession):
    """Deactivate a subject from the catalog."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject.is_active = False
    await db.flush()
    await db.commit()


# ════════════════════════════════════════════════════════════════════════════════════
# SCOPED SUBJECT ROUTES (University/Faculty/Subject hierarchy)
# ════════════════════════════════════════════════════════════════════════════════════


@router.get(
    "/universities/{university_id}/faculties/{faculty_id}/subjects",
    response_model=list[SubjectRead],
)
async def list_faculty_subjects(
    university_id: UUID,
    faculty_id: UUID,
    db: DbSession,
    limit: int = 50,
    offset: int = 0,
):
    """List all subjects for a faculty."""
    # Verify faculty exists and belongs to the university
    fac_result = await db.execute(
        select(Faculty).where(
            (Faculty.id == faculty_id) & (Faculty.university_id == university_id)
        )
    )
    if not fac_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    stmt = (
        select(Subject)
        .where(
            (Subject.faculty_id == faculty_id) & (Subject.is_active.is_(True))
        )
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/universities/{university_id}/faculties/{faculty_id}/subjects",
    response_model=SubjectRead,
    status_code=201,
)
async def create_faculty_subject(
    university_id: UUID,
    faculty_id: UUID,
    body: SubjectCreate,
    db: DbSession,
):
    """Create a new subject in a faculty."""
    # Verify faculty exists and belongs to the university
    fac_result = await db.execute(
        select(Faculty).where(
            (Faculty.id == faculty_id) & (Faculty.university_id == university_id)
        )
    )
    faculty = fac_result.scalar_one_or_none()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Verify all IDs in path and body match
    if (
        body.university_id != university_id
        or body.faculty_id != faculty_id
    ):
        raise HTTPException(
            status_code=400,
            detail="University and Faculty IDs in path and body must match",
        )
    
    # Verify semester_number is valid (1 to faculty.number_of_semesters)
    if (
        body.semester_number < 1
        or body.semester_number > faculty.number_of_semesters
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Semester number must be between 1 and {faculty.number_of_semesters}",
        )
    
    # Check if subject with this name already exists in this faculty/semester combination
    stmt = select(Subject).where(
        (Subject.faculty_id == faculty_id)
        & (Subject.semester_number == body.semester_number)
        & (Subject.name == body.name)
    )
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Subject with this name already exists in this faculty/semester",
        )
    
    subject = Subject(**body.model_dump())
    db.add(subject)
    await db.flush()
    await db.commit()
    await db.refresh(subject)
    return subject


@router.get(
    "/universities/{university_id}/faculties/{faculty_id}/subjects/{subject_id}",
    response_model=SubjectRead,
)
async def get_faculty_subject(
    university_id: UUID,
    faculty_id: UUID,
    subject_id: UUID,
    db: DbSession,
):
    """Get a specific subject from a faculty."""
    # Verify faculty exists
    fac_result = await db.execute(
        select(Faculty).where(
            (Faculty.id == faculty_id) & (Faculty.university_id == university_id)
        )
    )
    if not fac_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    result = await db.execute(
        select(Subject).where(Subject.id == subject_id)
    )
    subject = result.scalar_one_or_none()
    if (
        not subject
        or subject.faculty_id != faculty_id
        or subject.university_id != university_id
    ):
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject