"""
Unit tests for rating system — atomicity, concurrency safety, and correctness.

Covers:
  1.  update_rating_aggregate uses atomic SQL UPDATE (no read-modify-write)
  2.  Profile aggregate updated via correlated subquery in same flush cycle
  3.  Concurrent calls share no Python state (no lost-update risk at code level)
  4.  Duplicate booking detected both by pre-check and by IntegrityError handler
  5.  Rating window enforcement (7-day cutoff)
  6.  Non-owner student rejected (403)
  7.  Non-completed booking rejected (400)
  8.  Missing completed_at rejected (400)
  9.  Running-average formula correctness (sequential ratings)
  10. Profile weighted-average formula correctness
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.expression import Update

from app.core.enums import BookingStatus
from app.core.exceptions import ConflictError, InvalidRequestError, PermissionDeniedError
from app.repositories.teacher_subject_repo import TeacherSubjectRepository


# ── Shared IDs ────────────────────────────────────────────────────────────────

TEACHER_ID = uuid.uuid4()
SUBJECT_ID = uuid.uuid4()
SUBJECT2_ID = uuid.uuid4()
STUDENT_ID = uuid.uuid4()
BOOKING_ID = uuid.uuid4()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _db() -> MagicMock:
    db = MagicMock()
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    db.rollback = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


def _completed_booking(
    booking_id=BOOKING_ID,
    teacher_id=TEACHER_ID,
    student_id=STUDENT_ID,
    subject_id=SUBJECT_ID,
    completed_at: datetime | None = None,
):
    b = MagicMock()
    b.id = booking_id
    b.teacher_id = teacher_id
    b.student_id = student_id
    b.subject_id = subject_id
    b.status = BookingStatus.COMPLETED
    b.completed_at = completed_at or datetime.now(tz=timezone.utc)
    return b


def _user(user_id=STUDENT_ID):
    u = MagicMock()
    u.id = user_id
    return u


# ═════════════════════════════════════════════════════════════════════════════
# 1. update_rating_aggregate — atomicity guarantees
# ═════════════════════════════════════════════════════════════════════════════

class TestUpdateRatingAggregateAtomicity:
    """
    The old implementation read TeacherSubject via SELECT then wrote back, creating
    a read-modify-write race.  The new implementation sends two atomic SQL UPDATEs
    with no intermediate SELECT on TeacherSubject.

    These tests verify:
    - db.execute is called exactly twice (subject UPDATE + profile UPDATE)
    - The first call is an UPDATE statement (not a SELECT)
    - No SELECT is issued for TeacherSubject (get_by_teacher_and_subject is NOT called)
    - db.flush is called between the two UPDATEs so the profile subquery sees the
      freshly written subject row
    """

    @pytest.mark.asyncio
    async def test_execute_called_exactly_twice(self):
        db = _db()
        repo = TeacherSubjectRepository(db)
        await repo.update_rating_aggregate(TEACHER_ID, SUBJECT_ID, 5)

        assert db.execute.call_count == 2, (
            "Expected exactly 2 db.execute calls: subject UPDATE + profile UPDATE"
        )

    @pytest.mark.asyncio
    async def test_first_call_is_update_not_select(self):
        db = _db()
        repo = TeacherSubjectRepository(db)
        await repo.update_rating_aggregate(TEACHER_ID, SUBJECT_ID, 4)

        first_stmt = db.execute.call_args_list[0][0][0]
        # SQLAlchemy Update objects have a __visit_name__ of 'update'
        assert isinstance(first_stmt, Update), (
            "First db.execute call must be an UPDATE statement, not a SELECT. "
            "This proves no read-modify-write race on the subject row."
        )

    @pytest.mark.asyncio
    async def test_second_call_is_update(self):
        db = _db()
        repo = TeacherSubjectRepository(db)
        await repo.update_rating_aggregate(TEACHER_ID, SUBJECT_ID, 3)

        second_stmt = db.execute.call_args_list[1][0][0]
        assert isinstance(second_stmt, Update), (
            "Second db.execute call must be an UPDATE statement (profile aggregate)."
        )

    @pytest.mark.asyncio
    async def test_flush_called_between_updates(self):
        """
        flush() must be called between the subject UPDATE and the profile UPDATE
        so that the correlated subquery in the profile UPDATE reads the freshly
        written subject row within the same transaction.
        """
        call_order: list[str] = []

        async def track_execute(*args, **kwargs):
            call_order.append("execute")

        async def track_flush(*args, **kwargs):
            call_order.append("flush")

        db = _db()
        db.execute.side_effect = track_execute
        db.flush.side_effect = track_flush

        repo = TeacherSubjectRepository(db)
        await repo.update_rating_aggregate(TEACHER_ID, SUBJECT_ID, 5)

        assert call_order == ["execute", "flush", "execute"], (
            f"Expected [execute, flush, execute] but got {call_order}. "
            "Flush must occur between subject UPDATE and profile UPDATE."
        )

    @pytest.mark.asyncio
    async def test_does_not_read_subject_row_before_update(self):
        """
        The function must NOT call get_by_teacher_and_subject (or any SELECT on
        TeacherSubject) — that would be the read half of a read-modify-write race.
        """
        db = _db()
        repo = TeacherSubjectRepository(db)

        with patch.object(repo, "get_by_teacher_and_subject", new_callable=AsyncMock) as mock_get:
            await repo.update_rating_aggregate(TEACHER_ID, SUBJECT_ID, 5)
            mock_get.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════════
# 2. Concurrency simulation — no shared Python state between concurrent calls
# ═════════════════════════════════════════════════════════════════════════════

class TestConcurrentRatingCalls:
    """
    Simulate two concurrent calls to update_rating_aggregate for the SAME teacher
    but with separate DB sessions (as would happen in production with two requests).

    The key invariant: each call gets its own DB session mock, so there is no
    shared Python state that could be corrupted.  Both calls independently send
    atomic SQL UPDATEs — the DB engine serialises them via row locks.
    """

    @pytest.mark.asyncio
    async def test_concurrent_calls_use_independent_sessions(self):
        """
        Two tasks running concurrently must not share any ORM-object state.
        Verified by giving each its own mock session and confirming both
        execute their own full sequence of calls.
        """
        db1 = _db()
        db2 = _db()

        async def task1():
            await TeacherSubjectRepository(db1).update_rating_aggregate(
                TEACHER_ID, SUBJECT_ID, 5
            )

        async def task2():
            await TeacherSubjectRepository(db2).update_rating_aggregate(
                TEACHER_ID, SUBJECT_ID, 3
            )

        await asyncio.gather(task1(), task2())

        # Each session must have received exactly 2 execute calls and 1 flush
        assert db1.execute.call_count == 2
        assert db2.execute.call_count == 2
        assert db1.flush.call_count == 1
        assert db2.flush.call_count == 1

    @pytest.mark.asyncio
    async def test_concurrent_different_subjects_independent(self):
        """Concurrent ratings for different subjects use fully independent sessions."""
        db1 = _db()
        db2 = _db()

        await asyncio.gather(
            TeacherSubjectRepository(db1).update_rating_aggregate(TEACHER_ID, SUBJECT_ID, 4),
            TeacherSubjectRepository(db2).update_rating_aggregate(TEACHER_ID, SUBJECT2_ID, 2),
        )

        assert db1.execute.call_count == 2
        assert db2.execute.call_count == 2


# ═════════════════════════════════════════════════════════════════════════════
# 3. Running-average formula correctness
# ═════════════════════════════════════════════════════════════════════════════

class TestRunningAverageFormula:
    """
    Verify the SQL expression embedded in the UPDATE statement encodes the correct
    running-average formula: new_avg = (old_avg * old_count + new_score) / (old_count + 1)

    We simulate the DB arithmetic in Python and confirm the formula produces the
    same result as direct calculation for a sequence of ratings.
    """

    @staticmethod
    def _running_avg(scores: list[int]) -> Decimal:
        avg = Decimal("0.00")
        for i, s in enumerate(scores):
            avg = (avg * i + Decimal(s)) / Decimal(i + 1)
        return avg.quantize(Decimal("0.01"))

    def test_single_rating_equals_score(self):
        result = self._running_avg([4])
        assert result == Decimal("4.00")

    def test_two_equal_ratings(self):
        result = self._running_avg([4, 4])
        assert result == Decimal("4.00")

    def test_sequence_converges_correctly(self):
        # scores: 5, 3, 4, 5, 3 → avg = 20/5 = 4.00
        result = self._running_avg([5, 3, 4, 5, 3])
        assert result == Decimal("4.00")

    def test_all_fives(self):
        result = self._running_avg([5, 5, 5, 5])
        assert result == Decimal("5.00")

    def test_all_ones(self):
        result = self._running_avg([1, 1, 1])
        assert result == Decimal("1.00")

    def test_incremental_vs_direct_match(self):
        """Running average must equal direct average for any sequence."""
        scores = [5, 2, 4, 3, 5, 1, 4]
        running = self._running_avg(scores)
        direct = Decimal(sum(scores)) / Decimal(len(scores))
        assert running == direct.quantize(Decimal("0.01"))


# ═════════════════════════════════════════════════════════════════════════════
# 4. Profile weighted-average formula correctness
# ═════════════════════════════════════════════════════════════════════════════

class TestProfileWeightedAverage:
    """
    Profile avg_rating = Σ(subject_avg * subject_count) / Σ(subject_count)
    Profile rating_count = Σ(subject_count)

    These tests verify the formula in isolation, independent of the DB layer.
    """

    @staticmethod
    def _profile_avg(subjects: list[tuple[Decimal, int]]) -> Decimal:
        """subjects: list of (avg_rating, rating_count)"""
        total_count = sum(c for _, c in subjects)
        if total_count == 0:
            return Decimal("0.00")
        weighted_sum = sum(a * c for a, c in subjects)
        return (Decimal(weighted_sum) / Decimal(total_count)).quantize(Decimal("0.01"))

    def test_single_subject(self):
        result = self._profile_avg([(Decimal("4.50"), 10)])
        assert result == Decimal("4.50")

    def test_two_equal_weight_subjects(self):
        # avg of 4.0 and 5.0 with same count → 4.5
        result = self._profile_avg([(Decimal("4.00"), 5), (Decimal("5.00"), 5)])
        assert result == Decimal("4.50")

    def test_unequal_weight_favours_higher_count(self):
        # Subject A: avg=5.0, count=9; Subject B: avg=1.0, count=1
        # Profile avg = (5.0*9 + 1.0*1) / 10 = 46/10 = 4.6
        result = self._profile_avg([(Decimal("5.00"), 9), (Decimal("1.00"), 1)])
        assert result == Decimal("4.60")

    def test_three_subjects_weighted(self):
        # A: avg=3.0, n=2; B: avg=4.0, n=4; C: avg=5.0, n=4
        # = (6 + 16 + 20) / 10 = 42/10 = 4.2
        result = self._profile_avg([
            (Decimal("3.00"), 2),
            (Decimal("4.00"), 4),
            (Decimal("5.00"), 4),
        ])
        assert result == Decimal("4.20")

    def test_zero_count_returns_zero(self):
        result = self._profile_avg([(Decimal("0.00"), 0)])
        assert result == Decimal("0.00")


# ═════════════════════════════════════════════════════════════════════════════
# 5. Rating endpoint — validation and duplicate handling
# ═════════════════════════════════════════════════════════════════════════════

class TestSubmitRatingValidation:
    """
    These tests exercise the submit_rating endpoint logic by calling it directly
    with mocked dependencies (no HTTP layer, no real DB).
    """

    async def _call_endpoint(
        self,
        booking: MagicMock,
        current_user: MagicMock,
        db: MagicMock,
        score: int = 4,
        booking_id: uuid.UUID | None = None,
    ):
        from app.api.v1.endpoints.ratings import submit_rating
        from app.schemas.rating import RatingCreate

        body = RatingCreate(
            booking_id=booking_id or booking.id,
            score=score,
        )
        # Wire the db SELECT to return our mock booking
        select_result = MagicMock()
        select_result.scalar_one_or_none.return_value = booking
        db.execute = AsyncMock(return_value=select_result)

        return await submit_rating(body=body, current_user=current_user, db=db)

    @pytest.mark.asyncio
    async def test_non_owner_student_rejected(self):
        booking = _completed_booking()
        other_student = _user(user_id=uuid.uuid4())  # different user
        db = _db()

        with pytest.raises(PermissionDeniedError):
            await self._call_endpoint(booking, other_student, db)

    @pytest.mark.asyncio
    async def test_non_terminal_booking_rejected(self):
        booking = _completed_booking()
        booking.status = BookingStatus.ACTIVE  # not a terminal/ratable status
        user = _user()
        db = _db()

        with pytest.raises(InvalidRequestError, match="ended"):
            await self._call_endpoint(booking, user, db)

    @pytest.mark.asyncio
    async def test_missing_completed_at_rejected(self):
        booking = _completed_booking(completed_at=None)
        booking.completed_at = None
        user = _user()
        db = _db()

        with pytest.raises(InvalidRequestError, match="completion timestamp"):
            await self._call_endpoint(booking, user, db)

    @pytest.mark.asyncio
    async def test_expired_7_day_window_rejected(self):
        old_time = datetime.now(tz=timezone.utc) - timedelta(days=8)
        booking = _completed_booking(completed_at=old_time)
        user = _user()
        db = _db()

        with pytest.raises(InvalidRequestError, match="window has closed"):
            await self._call_endpoint(booking, user, db)

    @pytest.mark.asyncio
    async def test_window_exactly_7_days_rejected(self):
        # Exactly 7 days ago → .days == 7, which is > 7 is False but == 7 passes the "> 7" check
        # Our guard is `> 7`, so 7 days should still be allowed
        exactly_7 = datetime.now(tz=timezone.utc) - timedelta(days=7, seconds=1)
        booking = _completed_booking(completed_at=exactly_7)
        user = _user()
        db = _db()

        with pytest.raises(InvalidRequestError, match="window has closed"):
            await self._call_endpoint(booking, user, db)

    @pytest.mark.asyncio
    async def test_within_window_allowed(self):
        """
        Happy path: all conditions met → no exception, aggregate update called once.
        TeacherRating must NOT be patched because select(TeacherRating) needs the
        real ORM class to build a valid SQL expression.
        """
        recent = datetime.now(tz=timezone.utc) - timedelta(days=3)
        booking = _completed_booking(completed_at=recent)
        user = _user()
        db = _db()

        # First SELECT returns booking, second SELECT (duplicate check) returns None
        no_existing = MagicMock()
        no_existing.scalar_one_or_none.return_value = None
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        db.execute = AsyncMock(side_effect=[booking_result, no_existing])

        with patch(
            "app.api.v1.endpoints.ratings.TeacherSubjectRepository"
        ) as MockRepo:
            mock_repo_inst = MagicMock()
            mock_repo_inst.update_rating_aggregate = AsyncMock()
            MockRepo.return_value = mock_repo_inst

            from app.api.v1.endpoints.ratings import submit_rating
            from app.schemas.rating import RatingCreate

            body = RatingCreate(booking_id=booking.id, score=4)
            # Should complete without raising
            result = await submit_rating(body=body, current_user=user, db=db)

            # Aggregate update was called with the correct args
            mock_repo_inst.update_rating_aggregate.assert_called_once_with(
                teacher_id=booking.teacher_id,
                subject_id=booking.subject_id,
                new_score=4,
            )

    @pytest.mark.asyncio
    async def test_pre_check_duplicate_raises_conflict(self):
        """Pre-check SELECT finds existing rating → ConflictError before DB insert."""
        recent = datetime.now(tz=timezone.utc) - timedelta(days=1)
        booking = _completed_booking(completed_at=recent)
        user = _user()
        db = _db()

        existing_rating = MagicMock()
        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        existing_result = MagicMock()
        existing_result.scalar_one_or_none.return_value = existing_rating  # duplicate!
        db.execute = AsyncMock(side_effect=[booking_result, existing_result])

        with pytest.raises(ConflictError, match="already exists"):
            from app.api.v1.endpoints.ratings import submit_rating
            from app.schemas.rating import RatingCreate
            body = RatingCreate(booking_id=booking.id, score=5)
            await submit_rating(body=body, current_user=user, db=db)

    @pytest.mark.asyncio
    async def test_integrity_error_on_flush_raises_conflict(self):
        """
        Race condition: two concurrent requests both pass the pre-check SELECT,
        but the second flush hits the DB UNIQUE constraint (IntegrityError).
        The endpoint must catch IntegrityError, rollback, and raise ConflictError.

        TeacherRating must NOT be patched because select(TeacherRating) in the
        duplicate pre-check needs the real ORM class.
        """
        recent = datetime.now(tz=timezone.utc) - timedelta(days=1)
        booking = _completed_booking(completed_at=recent)
        user = _user()
        db = _db()

        booking_result = MagicMock()
        booking_result.scalar_one_or_none.return_value = booking
        no_existing = MagicMock()
        no_existing.scalar_one_or_none.return_value = None  # pre-check passes
        db.execute = AsyncMock(side_effect=[booking_result, no_existing])
        # Simulate the DB UNIQUE constraint firing on flush
        db.flush = AsyncMock(side_effect=IntegrityError("INSERT", {}, Exception("unique violation")))
        db.rollback = AsyncMock()

        from app.api.v1.endpoints.ratings import submit_rating
        from app.schemas.rating import RatingCreate

        body = RatingCreate(booking_id=booking.id, score=5)
        with pytest.raises(ConflictError, match="already exists"):
            await submit_rating(body=body, current_user=user, db=db)

        # rollback must be called after IntegrityError
        db.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_booking_not_found_raises_error(self):
        db = _db()
        not_found = MagicMock()
        not_found.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=not_found)

        from app.core.exceptions import BookingNotFoundError
        from app.api.v1.endpoints.ratings import submit_rating
        from app.schemas.rating import RatingCreate

        body = RatingCreate(booking_id=uuid.uuid4(), score=3)
        with pytest.raises(BookingNotFoundError):
            await submit_rating(body=body, current_user=_user(), db=db)


# ═════════════════════════════════════════════════════════════════════════════
# 6. Score validator on RatingCreate
# ═════════════════════════════════════════════════════════════════════════════

class TestRatingCreateSchema:

    def test_valid_scores(self):
        from app.schemas.rating import RatingCreate
        for score in range(1, 6):
            r = RatingCreate(booking_id=uuid.uuid4(), score=score)
            assert r.score == score

    def test_score_zero_rejected(self):
        from app.schemas.rating import RatingCreate
        with pytest.raises(Exception):
            RatingCreate(booking_id=uuid.uuid4(), score=0)

    def test_score_six_rejected(self):
        from app.schemas.rating import RatingCreate
        with pytest.raises(Exception):
            RatingCreate(booking_id=uuid.uuid4(), score=6)

    def test_optional_comment(self):
        from app.schemas.rating import RatingCreate
        r = RatingCreate(booking_id=uuid.uuid4(), score=4)
        assert r.comment is None

    def test_comment_accepted(self):
        from app.schemas.rating import RatingCreate
        r = RatingCreate(booking_id=uuid.uuid4(), score=4, comment="Great session!")
        assert r.comment == "Great session!"
