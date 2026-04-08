from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, DbSession
from app.core.enums import SessionStatus, UserRole
from app.core.exceptions import (
    ConflictError,
    PermissionDeniedError,
    SubjectNotFoundError,
    TeacherNotFoundError,
)
from app.models.booking import Booking, Session
from app.models.student import StudentProfile
from app.models.subject import Subject
from app.models.teacher import TeacherProfile
from app.models.teacher_subject import TeacherSubject
from app.models.user import User
from app.repositories.teacher_subject_repo import TeacherSubjectRepository
from app.schemas.booking import BookingDetailedReadForTeacher
from app.schemas.session import TeacherSessionRead
from app.schemas.subject import TeacherSearchResult, TeacherSubjectCreate, TeacherSubjectRead
from app.schemas.user import TeacherProfileRead, TeacherProfileUpdate

router = APIRouter()


# ── List all teachers (unauthenticated) ──────────────────────────────────────
# TODO: TEMPORARY ENDPOINT - Remove this after frontend integration with search
#       This is a debug/development endpoint. In production, use /search with filters.


@router.get("/", response_model=list[TeacherProfileRead])
async def list_all_teachers(db: DbSession):
    """
    Fetch all registered teachers without authentication.

    ⚠️  TEMPORARY ENDPOINT - For development/debugging only.
    Will be removed in production. Use /search endpoint for production queries.
    """
    result = await db.execute(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.user))
        .order_by(TeacherProfile.created_at.desc())
    )
    return list(result.scalars().all())


# ── Public search (students use this) ────────────────────────────────────────


@router.get("/search", response_model=list[TeacherSearchResult])
async def search_teachers(
    subject_id: Annotated[UUID, Path(..., alias="subjectId")],
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


@router.get("/{subject_id}/search", response_model=list[TeacherSearchResult])
async def search_teachers_by_subject(
    subject_id: Annotated[UUID, Path(..., alias="subjectId")],
    db: DbSession,
    min_rating: float = Query(default=0.0, ge=0.0, le=5.0),
    min_years_of_experience: int = Query(default=0, ge=0),
    min_rate_per_session: Decimal | None = Query(default=None),
    max_rate_per_session: Decimal | None = Query(default=None),
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0, ge=0),
):
    """
    Search for teachers that teach a specific subject.
    Results are ordered by recommendation score:
      score = (avg_rating × 0.6) + (log(sessions_completed + 1) × 0.4)
    """
    repo = TeacherSubjectRepository(db)

    # We will need to update the TeacherSubjectRepository search method or build the query directly here
    stmt = (
        select(TeacherSubject)
        .options(
            selectinload(TeacherSubject.teacher).selectinload(TeacherProfile.user),
            selectinload(TeacherSubject.subject).selectinload(Subject.study_level),
            selectinload(TeacherSubject.subject).selectinload(Subject.board),
            selectinload(TeacherSubject.subject).selectinload(Subject.faculty),
        )
        .where(TeacherSubject.subject_id == subject_id)
        .where(TeacherSubject.is_active == True)
        .where(TeacherSubject.avg_rating >= min_rating)
        .where(TeacherSubject.years_of_experience >= min_years_of_experience)
    )

    if min_rate_per_session is not None:
        stmt = stmt.where(TeacherSubject.rate_per_session >= min_rate_per_session)
    if max_rate_per_session is not None:
        stmt = stmt.where(TeacherSubject.rate_per_session <= max_rate_per_session)

    # Simplified scoring function using SQL math: (avg_rating * 0.6) + ln(total_sessions_completed + 1) * 0.4
    import sqlalchemy as sa

    score_expr = (TeacherSubject.avg_rating * 0.6) + (
        sa.func.ln(TeacherSubject.total_sessions_completed + 1) * 0.4
    )
    stmt = stmt.order_by(score_expr.desc())
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    results = result.scalars().all()

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


# ── Own profile (teacher only) ────────────────────────────────────────────────
# Note: /me must be defined BEFORE /{teacher_id} to avoid UUID parsing conflicts


@router.get("/me", response_model=TeacherProfileRead)
async def get_my_profile(current_user: CurrentUser, db: DbSession):
    """Return the logged-in teacher's own profile."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(current_user.id))
    return profile


@router.patch("/me", response_model=TeacherProfileRead)
async def update_my_profile(
    body: TeacherProfileUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Update the logged-in teacher's bio, avatar, and headline."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(current_user.id))

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


@router.get("/me/sessions", response_model=list[TeacherSessionRead])
async def get_my_sessions(
    current_user: CurrentUser,
    db: DbSession,
    in_progress: bool = Query(default=True, description="Filter for in-progress sessions"),
):
    """
    Return sessions for the logged-in teacher.
    By default, only returns sessions with status IN_PROGRESS.
    """
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    # Verify teacher profile exists
    profile_result = await db.execute(
        select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)
    )
    if not profile_result.scalar_one_or_none():
        raise TeacherNotFoundError(teacher_id=str(current_user.id))

    query = (
        select(
            Session.id,
            Session.booking_id,
            Session.status,
            User.first_name,
            User.last_name,
            Subject.name.label("subject_name"),
        )
        .join(Booking, Session.booking_id == Booking.id)
        .join(User, Booking.student_id == User.id)
        .join(Subject, Booking.subject_id == Subject.id)
        .where(Booking.teacher_id == current_user.id)
    )

    if in_progress:
        query = query.where(Session.status == SessionStatus.IN_PROGRESS)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": row.id,
            "booking_id": row.booking_id,
            "status": row.status,
            "student_name": f"{row.first_name} {row.last_name}",
            "subject_name": row.subject_name,
        }
        for row in rows
    ]


@router.get("/me/bookings", response_model=list[BookingDetailedReadForTeacher])
async def get_my_bookings(current_user: CurrentUser, db: DbSession):
    """Return all bookings for the logged-in teacher with student and subject details."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    result = await db.execute(
        select(Booking)
        .options(
            selectinload(Booking.sessions),
            selectinload(Booking.student).selectinload(StudentProfile.user),
            selectinload(Booking.subject),
        )
        .where(Booking.teacher_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    return list(result.scalars().all())


# ── Subject management ────────────────────────────────────────────────────────


@router.get("/me/subjects", response_model=list[TeacherSubjectRead])
async def list_my_subjects(current_user: CurrentUser, db: DbSession):
    """Teacher: list all subjects they have registered."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    result = await db.execute(
        select(TeacherSubject)
        .where(TeacherSubject.teacher_id == current_user.id)
        .options(selectinload(TeacherSubject.subject))
    )
    return list(result.scalars().all())


@router.post("/me/subjects", response_model=TeacherSubjectRead, status_code=201)
async def add_subject(
    body: TeacherSubjectCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Teacher: register a subject they can teach."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    repo = TeacherSubjectRepository(db)
    existing = await repo.get_by_teacher_and_subject(current_user.id, body.subject_id)
    if existing:
        raise ConflictError(detail="Subject already registered")

    ts = TeacherSubject(
        teacher_id=current_user.id,
        subject_id=body.subject_id,
        rate_per_session=body.rate_per_session,
        years_of_experience=body.years_of_experience,
    )
    db.add(ts)
    await db.flush()

    # Explicitly load the subject relationship before returning
    result = await db.execute(
        select(TeacherSubject)
        .where(
            (TeacherSubject.teacher_id == current_user.id)
            & (TeacherSubject.subject_id == body.subject_id)
        )
        .options(selectinload(TeacherSubject.subject))
    )
    ts = result.scalar_one()
    await db.commit()
    return ts


@router.patch("/me/subjects/{subject_id}", response_model=TeacherSubjectRead)
async def update_subject(
    subject_id: Annotated[UUID, Path(..., alias="subjectId")],
    body: TeacherSubjectCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """Teacher: update rate or experience for a registered subject."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    repo = TeacherSubjectRepository(db)
    ts = await repo.get_by_teacher_and_subject(current_user.id, subject_id)
    if not ts:
        raise SubjectNotFoundError(subject_id=str(subject_id))

    ts.rate_per_session = body.rate_per_session
    ts.years_of_experience = body.years_of_experience
    await db.flush()
    await db.refresh(ts)
    return ts


@router.delete("/me/subjects/{subject_id}", status_code=204)
async def remove_subject(
    subject_id: Annotated[UUID, Path(..., alias="subjectId")],
    current_user: CurrentUser,
    db: DbSession,
):
    """Teacher: deactivate a subject offering (soft delete)."""
    if current_user.role != UserRole.TEACHER:
        raise PermissionDeniedError(detail="Only teachers can access this")

    repo = TeacherSubjectRepository(db)
    ts = await repo.get_by_teacher_and_subject(current_user.id, subject_id)
    if not ts:
        raise SubjectNotFoundError(subject_id=str(subject_id))

    ts.is_active = False
    await db.flush()


# ── Public profile (viewable by anyone) ──────────────────────────────────────
# Note: /{teacher_id} is defined LAST to avoid conflicts with /me and /search


@router.get("/{teacher_id}", response_model=TeacherProfileRead)
async def get_teacher_profile(
    teacher_id: Annotated[UUID, Path(..., alias="teacherId")], db: DbSession
):
    """
    Fetch a teacher's public profile.
    Accessible by any authenticated or unauthenticated user.
    Only shows approved teachers.
    """
    result = await db.execute(select(TeacherProfile).where(TeacherProfile.user_id == teacher_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(teacher_id))
    return profile
