from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.dependencies import DbSession, CurrentUser
from app.core.enums import UserRole
from app.models.teacher import TeacherProfile
from app.models.booking import Booking
from app.repositories.teacher_subject_repo import TeacherSubjectRepository
from app.schemas.user import TeacherProfileRead, TeacherProfileUpdate
from app.schemas.subject import TeacherSearchResult, TeacherSubjectCreate, TeacherSubjectRead
from app.schemas.booking import BookingRead

router = APIRouter()


# ── Public search (students use this) ────────────────────────────────────────

@router.get("/search", response_model=list[TeacherSearchResult])
async def search_teachers(
    subject_id: UUID,
    db: DbSession,
    min_rating: float = Query(default=0.0, ge=0.0, le=5.0),
    max_rate: Decimal | None = Query(default=None),
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0, ge=0),
):
    """
    Search for teachers by subject.
    Results are ordered by recommendation score:
      score = (avg_rating × 0.6) + (log(sessions_completed + 1) × 0.4)
    """
    repo = TeacherSubjectRepository(db)
    results = await repo.search(
        subject_id=subject_id,
        min_rating=min_rating,
        max_rate=max_rate,
        limit=limit,
        offset=offset,
    )
    return [
        TeacherSearchResult(
            teacher_id=ts.teacher_id,
            subject_id=ts.subject_id,
            rate_per_session=ts.rate_per_session,
            years_of_experience=ts.years_of_experience,
            avg_rating=ts.avg_rating,
            rating_count=ts.rating_count,
            total_sessions_completed=ts.total_sessions_completed,
            teacher_name=f"{ts.teacher.user.first_name} {ts.teacher.user.last_name}",
            teacher_headline=ts.teacher.headline,
            teacher_avatar_url=ts.teacher.avatar_url,
            subject=ts.subject,
        )
        for ts in results
    ]


# ── Public profile (viewable by anyone) ──────────────────────────────────────

@router.get("/{teacher_id}", response_model=TeacherProfileRead)
async def get_teacher_profile(teacher_id: UUID, db: DbSession):
    """
    Fetch a teacher's public profile.
    Accessible by any authenticated or unauthenticated user.
    Only shows approved teachers.
    """
    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == teacher_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return profile


# ── Own profile (teacher only) ────────────────────────────────────────────────

@router.get("/me", response_model=TeacherProfileRead)
async def get_my_profile(current_user: CurrentUser, db: DbSession):
    """Return the logged-in teacher's own profile."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this")

    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return profile


@router.patch("/me", response_model=TeacherProfileRead)
async def update_my_profile(
    body: TeacherProfileUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update the logged-in teacher's bio, avatar, and headline."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this")

    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Teacher profile not found")

    if body.bio is not None:
        profile.bio = body.bio
    if body.avatar_url is not None:
        profile.avatar_url = body.avatar_url
    if body.headline is not None:
        profile.headline = body.headline

    await db.flush()
    await db.refresh(profile)
    return profile


# ── Own bookings ──────────────────────────────────────────────────────────────

@router.get("/me/bookings", response_model=list[BookingRead])
async def get_my_bookings(current_user: CurrentUser, db: DbSession):
    """Return all bookings for the logged-in teacher."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this")

    result = await db.execute(
        select(Booking)
        .options(joinedload(Booking.sessions))
        .where(Booking.teacher_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    return list(result.scalars().unique().all())


# ── Subject management ────────────────────────────────────────────────────────

@router.get("/me/subjects", response_model=list[TeacherSubjectRead])
async def list_my_subjects(current_user: CurrentUser, db: DbSession):
    """Teacher: list all subjects they have registered."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this")

    repo = TeacherSubjectRepository(db)
    subjects = await repo.list_by_teacher(current_user.id)
    return subjects


@router.post("/me/subjects", response_model=TeacherSubjectRead, status_code=201)
async def add_subject(
    body: TeacherSubjectCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Teacher: register a subject they can teach."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this")

    repo = TeacherSubjectRepository(db)
    existing = await repo.get_by_teacher_and_subject(current_user.id, body.subject_id)
    if existing:
        raise HTTPException(status_code=409, detail="Subject already registered")

    from app.models.teacher_subject import TeacherSubject
    ts = TeacherSubject(
        teacher_id=current_user.id,
        subject_id=body.subject_id,
        rate_per_session=body.rate_per_session,
        years_of_experience=body.years_of_experience,
    )
    db.add(ts)
    await db.flush()
    await db.refresh(ts)
    return ts


@router.patch("/me/subjects/{subject_id}", response_model=TeacherSubjectRead)
async def update_subject(
    subject_id: UUID,
    body: TeacherSubjectCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Teacher: update rate or experience for a registered subject."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this")

    repo = TeacherSubjectRepository(db)
    ts = await repo.get_by_teacher_and_subject(current_user.id, subject_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Subject not found")

    ts.rate_per_session = body.rate_per_session
    ts.years_of_experience = body.years_of_experience
    await db.flush()
    await db.refresh(ts)
    return ts


@router.delete("/me/subjects/{subject_id}", status_code=204)
async def remove_subject(
    subject_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    """Teacher: deactivate a subject offering (soft delete)."""
    if current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can access this")

    repo = TeacherSubjectRepository(db)
    ts = await repo.get_by_teacher_and_subject(current_user.id, subject_id)
    if not ts:
        raise HTTPException(status_code=404, detail="Subject not found")

    ts.is_active = False
    await db.flush()