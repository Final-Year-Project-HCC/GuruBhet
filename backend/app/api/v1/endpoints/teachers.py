import logging
import sqlalchemy as sa
import time
from decimal import Decimal
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Path, Query, File, Form, UploadFile, status, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, DbSession, RequireTeacher
from app.core.enums import SessionStatus, UserRole, VerificationStatus, DocumentType, BookingStatus
from app.core.exceptions import (
    ConflictError,
    PermissionDeniedError,
    SubjectNotFoundError,
    TeacherNotFoundError,
    InvalidDocumentError,
    UploadFailedError,
    PhoneAlreadyRegisteredError,
)
from app.models.booking import Booking, Session
from app.models.student import StudentProfile
from app.models.subject import Subject
from app.models.rating import TeacherRating
from app.models.teacher import TeacherProfile
from app.models.teacher_subject import TeacherSubject
from app.models.user import User
from app.repositories.teacher_subject_repo import TeacherSubjectRepository
from app.repositories.user_repo import UserRepository
from app.schemas.booking import BookingDetailedReadForTeacher
from app.schemas.rating import RatingRead
from app.schemas.session import TeacherSessionRead
from app.schemas.subject import TeacherSearchResult, TeacherSubjectCreate, TeacherSubjectRead
from app.schemas.user import TeacherProfileRead, TeacherProfilePrivateRead, TeacherProfileUpdate
from app.models.teacher_document import TeacherDocument
from app.utils.cloudinary import get_cloudinary_manager

logger = logging.getLogger(__name__)
router = APIRouter()

# ── List all teachers (unauthenticated) ──────────────────────────────────────

@router.get("/", response_model=list[TeacherProfileRead])
async def list_all_teachers(db: DbSession, limit: int = Query(default=100, le=100)):
    """
    Fetch registered teachers without authentication (Dev/Debug only).
    Includes a default limit for safety.
    """
    result = await db.execute(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.user))
        .order_by(TeacherProfile.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())

# ── Public search (students use this) ────────────────────────────────────────

@router.get("/search", response_model=list[TeacherSearchResult])
async def search_teachers(
    subject_id: Annotated[UUID, Query(..., alias="subjectId")],
    db: DbSession,
    min_rating: float = Query(default=0.0, ge=0.0, le=5.0),
    min_rate: Decimal | None = Query(default=None),
    max_rate: Decimal | None = Query(default=None),
    limit: int = Query(default=20, le=50),
    offset: int = Query(default=0, ge=0),
):
    repo = TeacherSubjectRepository(db)
    results = await repo.search(
        subject_id=subject_id,
        min_rating=min_rating,
        min_rate=min_rate,
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
            teacher_tagline=ts.teacher.tagline,
            teacher_avatar_url=ts.teacher.user.avatar_url,
            subject=ts.subject,
        )
        for ts in results
    ]

# ── Own profile (teacher only) ────────────────────────────────────────────────

@router.get("/me/profile", response_model=TeacherProfilePrivateRead)
async def get_my_profile(current_user: Annotated[User, RequireTeacher], db: DbSession):
    """Return the logged-in teacher's own profile."""
    result = await db.execute(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.documents), selectinload(TeacherProfile.user))
        .where(TeacherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(current_user.id))
    return profile

@router.patch("/me/profile", response_model=TeacherProfilePrivateRead)
async def update_my_profile(
    body: TeacherProfileUpdate,
    current_user: Annotated[User, RequireTeacher],
    db: DbSession,
):
    """Update the logged-in teacher's bio, avatar, and tagline."""
    result = await db.execute(
        select(TeacherProfile)
        .where(TeacherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(current_user.id))

    update_data = body.model_dump(exclude_unset=True)
    # Update profile fields
    for key in ["bio", "tagline"]:
        if key in update_data:
            setattr(profile, key, update_data[key])

    # Update user fields if present
    for key in ["first_name", "middle_name", "last_name"]:
        if key in update_data:
            setattr(current_user, key, update_data[key])

    await db.commit()

    result = await db.execute(
        select(TeacherProfile)
        .options(
            selectinload(TeacherProfile.documents), 
            selectinload(TeacherProfile.user)
        )
        .where(TeacherProfile.user_id == current_user.id)
    )
    return result.scalar_one()

@router.patch("/onboarding/documents", response_model=TeacherProfilePrivateRead)
async def submit_onboarding_documents(
    current_user: Annotated[User, RequireTeacher],
    db: DbSession,
    nid_front: Annotated[UploadFile, File(..., alias="nidFront")],
    nid_back: Annotated[UploadFile, File(..., alias="nidBack")],
    pan_card: Annotated[UploadFile, File(..., alias="panCard")],
    selfie_with_nid: Annotated[UploadFile, File(..., alias="selfieWithNid")],
    phone: Annotated[str | None, Form()] = None,
):
    """Upload KYC documents. Handles async Cloudinary uploads and DB transaction safety."""
    
    # 1. Verification and Phone logic
    if not current_user.phone and not phone:
        raise InvalidDocumentError(detail="Phone number is required for KYC.")

    if not current_user.phone and phone:
        repo = UserRepository(db)
        if await repo.phone_exists(phone):
            raise PhoneAlreadyRegisteredError(phone=phone)
        current_user.phone = phone

    result = await db.execute(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.documents))
        .where(TeacherProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(current_user.id))

    if profile.document_status == VerificationStatus.APPROVED:
        raise ConflictError(detail="KYC documents are already approved.")

    # 2. Upload preparation
    docs_to_upload = [
        (DocumentType.NID_FRONT, nid_front),
        (DocumentType.NID_BACK, nid_back),
        (DocumentType.PAN_CARD, pan_card),
        (DocumentType.SELFIE_WITH_NID, selfie_with_nid),
    ]

    cloudinary_mgr = get_cloudinary_manager()
    folder_path = f"teachers/{current_user.id}/kyc"
    uploaded_public_ids = []

    try:
        for doc_type, upload_file in docs_to_upload:
            if not upload_file.content_type or not upload_file.content_type.startswith("image/"):
                raise InvalidDocumentError(detail=f"File {upload_file.filename} is not a valid image.")

            # Read content before passing to threadpool
            content = await upload_file.read()

            # Offload blocking Cloudinary call to threadpool
            upload_result = await run_in_threadpool(
                cloudinary_mgr.upload_file,
                file_obj=content,
                folder=folder_path,
            )
            
            public_id = upload_result.get("public_id")
            uploaded_public_ids.append(public_id)

            doc = TeacherDocument(
                teacher_id=profile.user_id,
                type=doc_type,
                file_url=upload_result.get("secure_url"),
                file_key=public_id,
                status=VerificationStatus.PENDING
            )
            db.add(doc)

        profile.document_status = VerificationStatus.PENDING
        await db.commit()
    except Exception as e:
        await db.rollback()
        # Clean up orphaned Cloudinary files in threadpool
        for pid in uploaded_public_ids:
            try:
                await run_in_threadpool(cloudinary_mgr.delete_file, pid)
            except Exception as del_err:
                logger.error(f"Cleanup failed for {pid}: {del_err}")
        
        if isinstance(e, HTTPException):
            raise e
        raise UploadFailedError(detail=f"KYC upload failed: {str(e)}", cause=e)

    # 3. Refresh and Return
    result = await db.execute(
        select(TeacherProfile)
        .options(
            selectinload(TeacherProfile.documents), 
            selectinload(TeacherProfile.user)
        )
        .where(TeacherProfile.user_id == current_user.id)
    )
    return result.scalar_one()

# ── Own bookings ──────────────────────────────────────────────────────────────

@router.get("/me/sessions", response_model=list[TeacherSessionRead])
async def get_my_sessions(
    current_user: Annotated[User, RequireTeacher],
    db: DbSession,
    in_progress: bool = Query(default=True),
):
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
    return [
        {
            "id": row.id,
            "booking_id": row.booking_id,
            "status": row.status,
            "student_name": f"{row.first_name} {row.last_name}",
            "subject_name": row.subject_name,
        }
        for row in result.all()
    ]

@router.get("/me/bookings", response_model=list[BookingDetailedReadForTeacher])
async def get_my_bookings(current_user: Annotated[User, RequireTeacher], db: DbSession):
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


@router.post("/me/subjects", response_model=TeacherSubjectRead, status_code=201)
async def add_subject(
    body: TeacherSubjectCreate,
    current_user: Annotated[User, RequireTeacher],
    db: DbSession,
):
    repo = TeacherSubjectRepository(db)
    # Check if the relationship exists (even if inactive)
    existing = await repo.get_by_teacher_and_subject(current_user.id, body.subject_id)
    
    if existing:
        if existing.is_active:
            raise ConflictError(detail="Subject already registered")
        # Reactivate soft-deleted subject
        existing.is_active = True
        existing.rate_per_session = body.rate_per_session
        existing.years_of_experience = body.years_of_experience
    else:
        ts = TeacherSubject(
            teacher_id=current_user.id,
            subject_id=body.subject_id,
            rate_per_session=body.rate_per_session,
            years_of_experience=body.years_of_experience,
        )
        db.add(ts)

    await db.commit()
    
    # Re-fetch for relationships
    result = await db.execute(
        select(TeacherSubject)
        .options(selectinload(TeacherSubject.subject))
        .where(TeacherSubject.teacher_id == current_user.id, TeacherSubject.subject_id == body.subject_id)
    )
    return result.scalar_one()

@router.delete("/me/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_subject(
    subject_id: UUID,
    current_user: Annotated[User, RequireTeacher],
    db: DbSession,
):
    """
    Soft-delete a subject from the teacher's active catalog.
    """
    # 1. Check for active or pending bookings first
    # We prevent deletion if there are commitments that haven't reached a terminal state
    active_booking_check = await db.execute(
        select(Booking).where(
            Booking.teacher_id == current_user.id,
            Booking.subject_id == subject_id,
            Booking.status.in_([
                BookingStatus.PENDING_APPROVAL,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.ACTIVE
            ])
        ).limit(1)
    )
    if active_booking_check.scalar_one_or_none():
        raise ConflictError(detail="Cannot delete subject with active or pending bookings. Please complete or cancel them first.")

    result = await db.execute(
        select(TeacherSubject).where(
            TeacherSubject.teacher_id == current_user.id,
            TeacherSubject.subject_id == subject_id,
            TeacherSubject.is_active == True
        )
    )
    ts = result.scalar_one_or_none()
    if not ts:
        raise HTTPException(status_code=404, detail="Active subject registration not found.")

    ts.is_active = False
    await db.commit()

# ── Public profile (viewable by anyone) ──────────────────────────────────────

@router.get("/{teacher_id}/profile", response_model=TeacherProfileRead)
async def get_teacher_public_profile(
    teacher_id:UUID, db: DbSession
):
    """
    Fetch a teacher's public profile.
    Only profiles of teachers with APPROVED document status are visible.
    """
    result = await db.execute(
        select(TeacherProfile)
        .options(selectinload(TeacherProfile.user))
        .where(
            TeacherProfile.user_id == teacher_id,
            TeacherProfile.document_status == VerificationStatus.APPROVED
        )
    )
    profile = result.scalar_one_or_none()
    
    # If teacher doesn't exist or is not yet verified, we return 404 
    # to avoid leaking that an unverified teacher exists at this ID.
    if not profile:
        raise TeacherNotFoundError(teacher_id=str(teacher_id))

    return profile

@router.get("/{teacher_id}/subjects", response_model=list[TeacherSubjectRead])
async def get_teacher_public_subjects(
    teacher_id: UUID, db: DbSession
):
    """
    Fetch a teacher's list of subjects and rates.
    Only visible for teachers with APPROVED document status.
    """
    # We join with TeacherProfile to ensure the teacher is verified
    result = await db.execute(
        select(TeacherSubject)
        .join(TeacherProfile, TeacherSubject.teacher_id == TeacherProfile.user_id)
        .options(selectinload(TeacherSubject.subject))
        .where(
            TeacherSubject.teacher_id == teacher_id,
            TeacherSubject.is_active == True,
            TeacherProfile.document_status == VerificationStatus.APPROVED
        )
        .limit(100)  # Internal safety limit
    )
    subjects = result.scalars().all()
    
    # We return an empty list if no active subjects found for a verified teacher,
    # or if the teacher is unverified/non-existent.
    return list(subjects)

@router.get("/{teacher_id}/ratings", response_model=list[RatingRead])
async def get_teacher_latest_ratings(
    teacher_id: UUID, db: DbSession
):
    """
    Fetch the latest 3 ratings for a verified teacher.
    """
    # Ensure the teacher is verified (consistent with other public teacher routes)
    teacher_check = await db.execute(
        select(TeacherProfile.user_id).where(
            TeacherProfile.user_id == teacher_id,
            TeacherProfile.document_status == VerificationStatus.APPROVED
        )
    )
    if not teacher_check.scalar_one_or_none():
        raise TeacherNotFoundError(teacher_id=str(teacher_id))

    result = await db.execute(
        select(TeacherRating)
        .where(TeacherRating.teacher_id == teacher_id)
        .order_by(TeacherRating.created_at.desc())
        .limit(3)
    )
    return list(result.scalars().all())