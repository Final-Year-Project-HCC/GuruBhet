from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Path, Query

from app.core.dependencies import CurrentUser, DbSession, RequireVerifiedEmail
from app.models.user import User
from app.schemas.rating import RatingCreate, RatingRead

router = APIRouter()


@router.post("/", response_model=RatingRead, status_code=201)
async def submit_rating(body: RatingCreate, current_user: Annotated[User, RequireVerifiedEmail], db: DbSession):
    """
    Student submits a rating for a completed session.
    Triggers: update TeacherSubject.avg_rating + rating_count (running average).
    One rating per session — enforced at DB level (UNIQUE on session_id).
    """
    ...


@router.get("/teacher/{teacher_id}", response_model=list[RatingRead])
async def get_teacher_ratings(
    teacher_id: Annotated[UUID, Path(..., alias="teacherId")],
    subject_id: UUID | None = Query(default=None, alias="subjectId"),
    db: DbSession = None,
):
    """Public: list a teacher's ratings, optionally filtered by subject."""
    ...
