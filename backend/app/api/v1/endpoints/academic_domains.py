from uuid import UUID
from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.dependencies import DbSession
from app.models.university import University
from app.models.faculty import Faculty
from app.schemas.academic_domains import (
    UniversityCreate,
    UniversityRead,
    FacultyCreate,
    FacultyRead,
)

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
    await db.commit()
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
    await db.commit()
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
    body: dict,  # {"faculties": [FacultyCreate]}
    db: DbSession,
):
    """Bulk create faculties."""
    faculties_data = body.get("faculties", [])
    if not faculties_data:
        raise HTTPException(status_code=400, detail="No faculties provided")
    
    created_faculties = []
    
    for faculty_data in faculties_data:
        university_id = faculty_data.get("university_id")
        
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
            & (Faculty.name == faculty_data.get("name"))
        )
        existing = await db.execute(stmt)
        if existing.scalar_one_or_none():
            continue  # Skip duplicates
        
        faculty = Faculty(**faculty_data)
        db.add(faculty)
        created_faculties.append(faculty)
    
    if created_faculties:
        await db.flush()
        for faculty in created_faculties:
            await db.refresh(faculty)
    
    return created_faculties
