from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_, update, literal
from sqlalchemy.types import Float, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.teacher_subject import TeacherSubject
from app.models.teacher import TeacherProfile
from app.models.subject import Subject
from app.repositories.base import BaseRepository


class TeacherSubjectRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def search(
        self,
        subject_id: UUID,
        min_rating: float = 0.0,
        min_rate: Decimal | None = None,
        max_rate: Decimal | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[TeacherSubject]:
        """
        Search active teacher-subject offerings.

        Ordered by a composite recommendation score:
          score = (avg_rating * 0.6) + (log(total_sessions_completed + 1) * 0.4)

        This rewards both quality (rating) and proven track record (experience).
        """
        filters = [
            TeacherSubject.subject_id == subject_id,
            TeacherSubject.is_active.is_(True),
            TeacherSubject.avg_rating >= min_rating,
        ]
        if min_rate is not None:
            filters.append(TeacherSubject.rate_per_session >= min_rate)
        if max_rate is not None:
            filters.append(TeacherSubject.rate_per_session <= max_rate)

        # Bayesian-adjusted rating: adjusted = (m*C + n*r) / (m + n)
        # C=3.5 (prior mean), m=10 (confidence weight)
        # Literals are explicitly typed as Float so Postgres doesn't inherit
        # NUMERIC(3,2) from avg_rating and overflow on values like 35.0.
        prior_weight = literal(10, Integer)
        prior_mean_x_weight = literal(35.0, Float)  # 10 * 3.5
        bayesian_avg = (
            (prior_mean_x_weight + TeacherSubject.rating_count * TeacherSubject.avg_rating)
            / (prior_weight + TeacherSubject.rating_count)
        )
        # Composite recommendation score
        score_expr = (
            bayesian_avg * literal(0.6, Float)
            + func.log(TeacherSubject.total_sessions_completed + 1) * literal(0.4, Float)
        )

        stmt = (
            select(TeacherSubject)
            .options(
                joinedload(TeacherSubject.teacher).joinedload(TeacherProfile.user),
                joinedload(TeacherSubject.subject),
            )
            .where(and_(*filters))
            .order_by(score_expr.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_by_teacher_and_subject(
        self, teacher_id: UUID, subject_id: UUID
    ) -> TeacherSubject | None:
        result = await self.db.execute(
            select(TeacherSubject).where(
                TeacherSubject.teacher_id == teacher_id,
                TeacherSubject.subject_id == subject_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_rating_aggregate(
        self, teacher_id: UUID, subject_id: UUID, new_score: int
    ) -> None:
        """
        Update avg_rating + rating_count with full atomicity:

        Step 1 — TeacherSubject: single SQL UPDATE using the running-average formula
          entirely within the DB engine.  No Python read-modify-write, so concurrent
          calls for the same row are serialised by the DB row lock.

          new_avg = ROUND((avg_rating * rating_count + score) / (rating_count + 1), 2)
          new_count = rating_count + 1

        Step 2 — TeacherProfile: correlated-subquery UPDATE that recomputes the
          weighted average across ALL subjects for this teacher in a single statement.
          A flush between the two steps guarantees the subquery sees the freshly
          updated subject row within the same transaction.
        """
        # Step 1: atomic running-average on the subject row (no SELECT needed)
        await self.db.execute(
            update(TeacherSubject)
            .where(
                TeacherSubject.teacher_id == teacher_id,
                TeacherSubject.subject_id == subject_id,
            )
            .values(
                avg_rating=func.round(
                    (
                        TeacherSubject.avg_rating * TeacherSubject.rating_count
                        + new_score
                    )
                    / (TeacherSubject.rating_count + 1),
                    2,
                ),
                rating_count=TeacherSubject.rating_count + 1,
            )
        )
        # Flush so the profile subquery below sees the updated subject row
        await self.db.flush()

        # Step 2: recompute profile aggregate via correlated subquery — one statement
        subq_avg = (
            select(
                func.coalesce(
                    func.round(
                        func.sum(
                            TeacherSubject.avg_rating * TeacherSubject.rating_count
                        )
                        / func.nullif(func.sum(TeacherSubject.rating_count), 0),
                        2,
                    ),
                    Decimal("0.00"),
                )
            )
            .where(TeacherSubject.teacher_id == teacher_id)
            .scalar_subquery()
        )
        subq_count = (
            select(func.coalesce(func.sum(TeacherSubject.rating_count), 0))
            .where(TeacherSubject.teacher_id == teacher_id)
            .scalar_subquery()
        )
        await self.db.execute(
            update(TeacherProfile)
            .where(TeacherProfile.user_id == teacher_id)
            .values(avg_rating=subq_avg, rating_count=subq_count)
        )

    async def increment_completed_sessions(self, teacher_id: UUID, subject_id: UUID) -> None:
        await self.db.execute(
            update(TeacherSubject)
            .where(
                TeacherSubject.teacher_id == teacher_id,
                TeacherSubject.subject_id == subject_id,
            )
            .values(total_sessions_completed=TeacherSubject.total_sessions_completed + 1)
        )

    async def increment_experience_minutes(self, teacher_id: UUID, subject_id: UUID, minutes: int) -> None:
        await self.db.execute(
            update(TeacherSubject)
            .where(
                TeacherSubject.teacher_id == teacher_id,
                TeacherSubject.subject_id == subject_id,
            )
            .values(experience_minutes=TeacherSubject.experience_minutes + minutes)
        )

    async def list_by_teacher(self, teacher_id: UUID) -> list[TeacherSubject]:
        result = await self.db.execute(
            select(TeacherSubject)
            .options(
                joinedload(TeacherSubject.subject),
            )
            .where(TeacherSubject.teacher_id == teacher_id)
            .order_by(TeacherSubject.is_active.desc())
        )
        return list(result.scalars().unique().all())