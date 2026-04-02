from uuid import UUID
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.dependencies import DbSession
from app.models.university import University
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.schemas.academic_domains import (
    UniversityCreate,
    UniversityRead,
    FacultyCreate,
    FacultyRead,
    BulkFacultyCreateRequest,
)
from app.schemas.subject import SubjectRead, SubjectCreate

router = APIRouter()


# ════════════════════════════════════════════════════════════════════════════════════
# UNIVERSITIES
# ════════════════════════════════════════════════════════════════════════════════════


@router.get("/universities", response_model=list[UniversityRead])
async def list_universities(
    db: DbSession,
    limit: int = 50,
    offset: int = 0,
):
    """List all universities."""
    stmt = select(University).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/universities", response_model=UniversityRead, status_code=201)
async def create_university(body: UniversityCreate, db: DbSession):
    """Create a new university."""
    # Check if university with this name already exists
    stmt = select(University).where(University.name == body.name)
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="University with this name already exists",
        )
    
    university = University(**body.model_dump())
    db.add(university)
    await db.flush()
    await db.refresh(university)
    return university


@router.get("/universities/{university_id}", response_model=UniversityRead)
async def get_university(university_id: UUID, db: DbSession):
    """Get a specific university."""
    result = await db.execute(
        select(University).where(University.id == university_id)
    )
    university = result.scalar_one_or_none()
    if not university:
        raise HTTPException(status_code=404, detail="University not found")
    return university


# ════════════════════════════════════════════════════════════════════════════════════
# FACULTIES
# ════════════════════════════════════════════════════════════════════════════════════


@router.get("/universities/{university_id}/faculties", response_model=list[FacultyRead])
async def list_faculties(
    university_id: UUID,
    db: DbSession,
    limit: int = 50,
    offset: int = 0,
):
    """List all faculties for a university."""
    # Verify university exists
    univ_result = await db.execute(
        select(University).where(University.id == university_id)
    )
    if not univ_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="University not found")
    
    stmt = (
        select(Faculty)
        .where(Faculty.university_id == university_id)
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/universities/{university_id}/faculties", response_model=FacultyRead, status_code=201)
async def create_faculty(
    university_id: UUID,
    body: FacultyCreate,
    db: DbSession,
):
    """Create a new faculty in a university."""
    # Verify university exists
    univ_result = await db.execute(
        select(University).where(University.id == university_id)
    )
    if not univ_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="University not found")
    
    # Verify university_id matches the path parameter
    if body.university_id != university_id:
        raise HTTPException(
            status_code=400,
            detail="University ID in path and body must match",
        )
    
    # Check if faculty with this name already exists in this university
    stmt = select(Faculty).where(
        (Faculty.university_id == university_id) & (Faculty.name == body.name)
    )
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Faculty with this name already exists in this university",
        )
    
    faculty = Faculty(**body.model_dump())
    db.add(faculty)
    await db.flush()
    await db.refresh(faculty)
    return faculty


@router.get(
    "/universities/{university_id}/faculties/{faculty_id}",
    response_model=FacultyRead,
)
async def get_faculty(
    university_id: UUID,
    faculty_id: UUID,
    db: DbSession,
):
    """Get a specific faculty."""
    result = await db.execute(
        select(Faculty).where(
            (Faculty.id == faculty_id) & (Faculty.university_id == university_id)
        )
    )
    faculty = result.scalar_one_or_none()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    return faculty


@router.post("/faculties/bulk", response_model=list[FacultyRead], status_code=201)
async def bulk_create_faculties(
    body: BulkFacultyCreateRequest,
    db: DbSession,
):  
    

    """Bulk create faculties."""
    faculties_data = body.faculties    
    if not faculties_data:
        raise HTTPException(status_code=400, detail="No faculties provided")
    
    created_faculties = []
    
    for faculty_data in faculties_data:
        university_id = faculty_data.university_id
        
        # Verify university exists
        univ_result = await db.execute(
            select(University).where(University.id == university_id)
        )
        if not univ_result.scalar_one_or_none():
            raise HTTPException(
                status_code=404,
                detail=f"University {university_id} not found",
            )
        
        # Check if faculty with this name already exists
        stmt = select(Faculty).where(
            (Faculty.university_id == university_id)
            & (Faculty.name == faculty_data.name)
        )
        existing = await db.execute(stmt)
        if existing.scalar_one_or_none():
            continue  # Skip duplicates
        
        faculty = Faculty(**faculty_data.model_dump())
        db.add(faculty)
        created_faculties.append(faculty)
    
    if created_faculties:
        await db.flush()
        for faculty in created_faculties:
            await db.refresh(faculty)
    
    return created_faculties


# ════════════════════════════════════════════════════════════════════════════════════
# SUBJECTS
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
    """Create a new subject for a faculty."""
    # Verify faculty exists and belongs to the university
    fac_result = await db.execute(
        select(Faculty).where(
            (Faculty.id == faculty_id) & (Faculty.university_id == university_id)
        )
    )
    faculty = fac_result.scalar_one_or_none()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Verify body university_id and faculty_id match path parameters
    if body.university_id != university_id or body.faculty_id != faculty_id:
        raise HTTPException(
            status_code=400,
            detail="University ID and Faculty ID in path and body must match",
        )
    
    # Verify semester_number is valid
    if body.semester_number < 1 or body.semester_number > faculty.number_of_semesters:
        raise HTTPException(
            status_code=400,
            detail=f"Semester number must be between 1 and {faculty.number_of_semesters}",
        )
    
    # Check if subject with this name already exists in this faculty/semester
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
