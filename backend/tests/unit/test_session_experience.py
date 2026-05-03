"""
Unit tests for experience-minutes tracking in handle_session_completion.

Tests cover:
  1. COMPLETED   → experience_minutes and total_experience_minutes incremented
  2. CANCELLED_BY_STUDENT → incremented (teacher did the work)
  3. CANCELLED_BY_TEACHER → NOT incremented
  4. Idempotency guard   → no-op when session not IN_PROGRESS
  5. Schema fields present on TeacherSubjectRead, TeacherSearchResult, TeacherProfileRead
"""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

from app.core.enums import SessionStatus, BookingStatus
from app.services.session_service import handle_session_completion


# ── Fixtures ──────────────────────────────────────────────────────────────────

TEACHER_ID = uuid.uuid4()
STUDENT_ID = uuid.uuid4()
SUBJECT_ID = uuid.uuid4()
BOOKING_ID = uuid.uuid4()
SESSION_ID = uuid.uuid4()
SESSION_DURATION = 60  # minutes


def _make_session(status: SessionStatus = SessionStatus.IN_PROGRESS) -> MagicMock:
    s = MagicMock()
    s.id = SESSION_ID
    s.status = status
    s.actual_end_at = None
    return s


def _make_booking(completed: int = 0, total: int = 3) -> MagicMock:
    b = MagicMock()
    b.id = BOOKING_ID
    b.teacher_id = TEACHER_ID
    b.student_id = STUDENT_ID
    b.subject_id = SUBJECT_ID
    b.rate_per_session = Decimal("500.00")
    b.session_duration_minutes = SESSION_DURATION
    b.completed_sessions = completed
    b.total_sessions = total
    b.status = BookingStatus.ACTIVE
    return b


def _make_db() -> MagicMock:
    db = MagicMock()
    db.add = MagicMock()
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    return db


# ── helpers ───────────────────────────────────────────────────────────────────

def _repo_mock():
    """Return a mock TeacherSubjectRepository with async methods."""
    repo = MagicMock()
    repo.increment_experience_minutes = AsyncMock()
    repo.increment_completed_sessions = AsyncMock()
    return repo


# ── 1. COMPLETED status ───────────────────────────────────────────────────────

class TestCompletedSession:

    @pytest.mark.asyncio
    async def test_experience_minutes_incremented(self):
        session = _make_session()
        booking = _make_booking()
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.COMPLETED,
            )

        repo.increment_experience_minutes.assert_awaited_once_with(
            teacher_id=TEACHER_ID,
            subject_id=SUBJECT_ID,
            minutes=SESSION_DURATION,
        )

    @pytest.mark.asyncio
    async def test_total_experience_minutes_incremented_atomically(self):
        """db.execute is called with an UPDATE for total_experience_minutes."""
        session = _make_session()
        booking = _make_booking()
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.COMPLETED,
            )

        # db.execute should have been called (for the UPDATE teacher_profiles SET ...)
        db.execute.assert_awaited()

    @pytest.mark.asyncio
    async def test_completed_sessions_incremented(self):
        session = _make_session()
        booking = _make_booking(completed=1, total=3)
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.COMPLETED,
            )

        assert booking.completed_sessions == 2

    @pytest.mark.asyncio
    async def test_booking_marked_completed_when_all_sessions_done(self):
        session = _make_session()
        booking = _make_booking(completed=2, total=3)
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.COMPLETED,
            )

        assert booking.status == BookingStatus.COMPLETED


# ── 2. CANCELLED_BY_STUDENT ───────────────────────────────────────────────────

class TestCancelledByStudent:

    @pytest.mark.asyncio
    async def test_experience_minutes_incremented(self):
        """Teacher did the work; student cancelled — experience still counts."""
        session = _make_session()
        booking = _make_booking()
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.CANCELLED_BY_STUDENT,
            )

        repo.increment_experience_minutes.assert_awaited_once_with(
            teacher_id=TEACHER_ID,
            subject_id=SUBJECT_ID,
            minutes=SESSION_DURATION,
        )

    @pytest.mark.asyncio
    async def test_total_experience_minutes_incremented_atomically(self):
        session = _make_session()
        booking = _make_booking()
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.CANCELLED_BY_STUDENT,
            )

        db.execute.assert_awaited()


# ── 3. CANCELLED_BY_TEACHER ───────────────────────────────────────────────────

class TestCancelledByTeacher:

    @pytest.mark.asyncio
    async def test_experience_minutes_NOT_incremented(self):
        """Teacher cancelled — no experience credit."""
        session = _make_session()
        booking = _make_booking()
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.CANCELLED_BY_TEACHER,
            )

        repo.increment_experience_minutes.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_total_experience_NOT_updated(self):
        """db.execute should not be called for experience update on teacher cancel."""
        session = _make_session()
        booking = _make_booking()
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.CANCELLED_BY_TEACHER,
            )

        db.execute.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_completed_sessions_still_incremented(self):
        """completed_sessions always increments regardless of who cancelled."""
        session = _make_session()
        booking = _make_booking(completed=1, total=5)
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.CANCELLED_BY_TEACHER,
            )

        assert booking.completed_sessions == 2


# ── 4. Idempotency guard ──────────────────────────────────────────────────────

class TestIdempotency:

    @pytest.mark.asyncio
    async def test_no_op_when_session_already_completed(self):
        session = _make_session(status=SessionStatus.COMPLETED)
        booking = _make_booking()
        db = _make_db()
        repo = _repo_mock()

        with patch("app.services.session_service.TeacherSubjectRepository", return_value=repo):
            await handle_session_completion(
                session=session,
                booking=booking,
                db=db,
                completion_status=SessionStatus.COMPLETED,
            )

        repo.increment_experience_minutes.assert_not_awaited()
        repo.increment_completed_sessions.assert_not_awaited()
        db.execute.assert_not_awaited()
        db.add.assert_not_called()


# ── 5. Schema fields ──────────────────────────────────────────────────────────

class TestSchemaFields:

    def test_teacher_subject_read_has_experience_minutes(self):
        from app.schemas.subject import TeacherSubjectRead
        fields = TeacherSubjectRead.model_fields
        assert "experience_minutes" in fields

    def test_teacher_search_result_has_experience_minutes(self):
        from app.schemas.subject import TeacherSearchResult
        fields = TeacherSearchResult.model_fields
        assert "experience_minutes" in fields

    def test_teacher_profile_read_has_total_experience_minutes(self):
        from app.schemas.user import TeacherProfileRead
        fields = TeacherProfileRead.model_fields
        assert "total_experience_minutes" in fields
