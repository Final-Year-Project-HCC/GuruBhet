from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query
from sqlalchemy import select

from app.core.dependencies import DbSession
from app.core.exceptions import InvalidRequestError, ResourceNotFoundError
from app.models.subject import Subject
from app.schemas.subject import (
    BulkSubjectCreateRequest,
    SubjectCreate,
    SubjectRead,
    SubjectSearchResponse,
)

router = APIRouter()


@router.get("/search", response_model=list[SubjectSearchResponse])
async def search_subjects(
    db: DbSession,
    name: str = Query(..., min_length=1, description="Prefix match for subject name"),
    limit: int = Query(default=50, le=200),
):
    """Search subjects by name prefix and return flattened contextual details."""
    stmt = select(Subject).where(Subject.name.ilike(f"{name}%")).limit(limit)
    result = await db.execute(stmt)
    subjects = result.scalars().all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "unit_value": s.unit_value,
            "study_level_name": s.study_level.name if s.study_level else "",
            "board_name": s.board.name if s.board else "",
            "faculty_name": s.faculty.name if s.faculty else "",
            "unit_type": s.faculty.unit_type
            if s.faculty
            else "GRADE",  # Fallback if somehow missing
        }
        for s in subjects
    ]


@router.get("/", response_model=list[SubjectRead])
async def list_subjects(
    db: DbSession,
    search: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List or search the subject catalog. Public endpoint."""
    stmt = select(Subject)
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
    await db.refresh(subject)
    return subject


@router.post("/bulk", response_model=list[SubjectRead], status_code=201)
async def bulk_create_subjects(
    body: BulkSubjectCreateRequest,
    db: DbSession,
):
    """Bulk create subjects."""
    subjects_data = body.subjects
    if not subjects_data:
        raise InvalidRequestError(detail="No subjects provided")

    created_subjects = []

    for subject_data in subjects_data:
        # Check if subject with this name already exists
        stmt = select(Subject).where(Subject.name == subject_data.name)
        existing = await db.execute(stmt)
        if existing.scalar_one_or_none():
            continue  # Skip duplicates

        subject = Subject(**subject_data.model_dump())
        db.add(subject)
        created_subjects.append(subject)

    if created_subjects:
        await db.flush()
        for subject in created_subjects:
            await db.refresh(subject)

    return created_subjects


@router.get("/{subject_id}", response_model=SubjectRead)
async def get_subject(subject_id: Annotated[UUID, Path(..., alias="subjectId")], db: DbSession):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise ResourceNotFoundError(detail="Subject not found")
    return subject


@router.delete("/{subject_id}", status_code=204)
async def delete_subject(subject_id: Annotated[UUID, Path(..., alias="subjectId")], db: DbSession):
    """Hard-delete a subject from the catalog (if not referenced)."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise ResourceNotFoundError(detail="Subject not found")
    await db.delete(subject)
    await db.flush()
