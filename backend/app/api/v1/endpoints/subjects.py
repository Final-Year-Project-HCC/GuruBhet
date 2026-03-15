from uuid import UUID
from fastapi import APIRouter, Query, HTTPException
from sqlalchemy import select

from app.core.dependencies import DbSession, RequireAdmin
from app.core.enums import StudyLevel
from app.models.subject import Subject
from app.schemas.subject import SubjectRead, SubjectCreate

router = APIRouter()


@router.get("/", response_model=list[SubjectRead])
async def list_subjects(
    db: DbSession,
    level: StudyLevel | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List or search the subject catalog. Public endpoint."""
    stmt = select(Subject).where(Subject.is_active.is_(True))
    if level:
        stmt = stmt.where(Subject.level == level)
    if search:
        stmt = stmt.where(Subject.name.ilike(f"%{search}%"))
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/", response_model=SubjectRead, status_code=201, dependencies=[RequireAdmin])
async def create_subject(body: SubjectCreate, db: DbSession):
    """Admin only: add a new subject to the catalog."""
    subject = Subject(**body.model_dump())
    db.add(subject)
    await db.flush()
    await db.refresh(subject)
    return subject


@router.get("/{subject_id}", response_model=SubjectRead)
async def get_subject(subject_id: UUID, db: DbSession):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.delete("/{subject_id}", status_code=204, dependencies=[RequireAdmin])
async def deactivate_subject(subject_id: UUID, db: DbSession):
    """Admin only: deactivate a subject from the catalog."""
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject.is_active = False
    await db.flush()