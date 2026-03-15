from uuid import UUID
from fastapi import APIRouter
from app.core.dependencies import DbSession, CurrentUser
from app.schemas.rating import RatingCreate, RatingRead

router = APIRouter()


@router.post("/", response_model=RatingRead, status_code=201)
async def submit_rating(body: RatingCreate, current_user: CurrentUser, db: DbSession):
    """
    Student submits a rating for a completed session.
    Triggers: update TeacherSubject.avg_rating + rating_count (running average).
    One rating per session — enforced at DB level (UNIQUE on session_id).
    """
    ...


@router.get("/teacher/{teacher_id}", response_model=list[RatingRead])
async def get_teacher_ratings(
    teacher_id: UUID,
    subject_id: UUID | None = None,
    db: DbSession = None,
):
    """Public: list a teacher's ratings, optionally filtered by subject."""
    ...