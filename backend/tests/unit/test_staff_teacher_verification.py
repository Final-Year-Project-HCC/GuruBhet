"""
Unit tests for staff teacher-verification logic.

These tests are intentionally pure-unit: no database, no HTTP client.
They exercise:
  1. _emit_profile_verified — the background-task helper
  2. verify_teacher endpoint logic (via direct function calls with mocked DB)
  3. get_next_pending_teacher endpoint logic
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from app.api.v1.endpoints.staff import _emit_profile_verified
from app.core.enums import VerificationStatus
from app.core.exceptions import ConflictError, TeacherNotFoundError
from app.schemas.staff import TeacherVerificationDecision


# ── Helpers ──────────────────────────────────────────────────────────────────

def _decision(action: VerificationStatus, remarks: str | None = None) -> TeacherVerificationDecision:
    return TeacherVerificationDecision(action=action, remarks=remarks)


# ── 0. TeacherVerificationDecision schema validation ─────────────────────────

class TestTeacherVerificationDecision:

    def test_approved_without_remarks_is_valid(self):
        d = TeacherVerificationDecision(action=VerificationStatus.APPROVED)
        assert d.remarks is None

    def test_approved_with_remarks_is_valid(self):
        d = TeacherVerificationDecision(action=VerificationStatus.APPROVED, remarks="Looks good")
        assert d.remarks == "Looks good"

    def test_rejected_with_remarks_is_valid(self):
        d = TeacherVerificationDecision(action=VerificationStatus.REJECTED, remarks="NID unclear")
        assert d.remarks == "NID unclear"

    def test_rejected_without_remarks_raises(self):
        with pytest.raises(ValidationError, match="remarks are required"):
            TeacherVerificationDecision(action=VerificationStatus.REJECTED)

    def test_rejected_with_blank_remarks_raises(self):
        with pytest.raises(ValidationError, match="remarks are required"):
            TeacherVerificationDecision(action=VerificationStatus.REJECTED, remarks="   ")


# ── 1. _emit_profile_verified ─────────────────────────────────────────────────

class TestEmitProfileVerified:

    @pytest.mark.asyncio
    async def test_emits_to_teacher_when_online(self, monkeypatch):
        """Calls emit_to_user with correct event and payload."""
        sio = MagicMock()
        sio.emit_to_user = AsyncMock()

        monkeypatch.setattr("app.api.v1.endpoints.staff.get_socketio_manager", lambda: sio)

        teacher_id = uuid.uuid4()
        decision = _decision(VerificationStatus.APPROVED, remarks="Looks good")

        await _emit_profile_verified(teacher_id, decision)

        sio.emit_to_user.assert_awaited_once_with(
            teacher_id,
            "profile_verified",
            {"action": "APPROVED", "remarks": "Looks good"},
        )

    @pytest.mark.asyncio
    async def test_emits_rejected_with_remarks(self, monkeypatch):
        sio = MagicMock()
        sio.emit_to_user = AsyncMock()

        monkeypatch.setattr("app.api.v1.endpoints.staff.get_socketio_manager", lambda: sio)

        teacher_id = uuid.uuid4()
        decision = _decision(VerificationStatus.REJECTED, remarks="Document unclear")

        await _emit_profile_verified(teacher_id, decision)

        sio.emit_to_user.assert_awaited_once_with(
            teacher_id,
            "profile_verified",
            {"action": "REJECTED", "remarks": "Document unclear"},
        )

    @pytest.mark.asyncio
    async def test_silent_when_manager_is_none(self, monkeypatch):
        """No error raised when socket manager is not initialised."""
        monkeypatch.setattr("app.api.v1.endpoints.staff.get_socketio_manager", lambda: None)

        # Must not raise
        await _emit_profile_verified(uuid.uuid4(), _decision(VerificationStatus.APPROVED))

    @pytest.mark.asyncio
    async def test_silent_when_emit_raises(self, monkeypatch):
        """Exceptions from the socket layer are swallowed, not propagated."""
        sio = MagicMock()
        sio.emit_to_user = AsyncMock(side_effect=RuntimeError("socket dead"))

        monkeypatch.setattr("app.api.v1.endpoints.staff.get_socketio_manager", lambda: sio)

        # Must not raise
        await _emit_profile_verified(uuid.uuid4(), _decision(VerificationStatus.APPROVED))

    @pytest.mark.asyncio
    async def test_no_online_check_performed(self, monkeypatch):
        """
        is_user_online is never called — emit is unconditional (room-based no-op
        if teacher is offline, consistent with session_finished behaviour).
        """
        sio = MagicMock()
        sio.emit_to_user = AsyncMock()
        sio.is_user_online = MagicMock(return_value=False)

        monkeypatch.setattr("app.api.v1.endpoints.staff.get_socketio_manager", lambda: sio)

        await _emit_profile_verified(uuid.uuid4(), _decision(VerificationStatus.APPROVED))

        sio.emit_to_user.assert_awaited_once()  # still emits even though "offline"
        sio.is_user_online.assert_not_called()


# ── 2. verify_teacher endpoint logic ─────────────────────────────────────────

def _make_document(doc_id=None, status=VerificationStatus.PENDING):
    doc = MagicMock()
    doc.id = doc_id or uuid.uuid4()
    doc.status = status
    doc.verified_by_id = None
    doc.verified_at = None
    doc.remarks = None
    return doc


def _make_profile(user_id=None, doc_status=VerificationStatus.PENDING, n_docs=2):
    profile = MagicMock()
    profile.user_id = user_id or uuid.uuid4()
    profile.document_status = doc_status
    profile.reviewed_by_id = None
    profile.reviewed_at = None
    profile.documents = [_make_document() for _ in range(n_docs)]
    return profile


def _make_staff(staff_id=None):
    staff = MagicMock()
    staff.id = staff_id or uuid.uuid4()
    staff.email = "staff@test.com"
    return staff


class TestVerifyTeacherLogic:
    """
    Test the business logic of verify_teacher by calling it directly
    with a mock DB session, bypassing FastAPI dependency injection.
    """

    @pytest.mark.asyncio
    async def test_approve_sets_profile_and_document_status(self):
        """APPROVED decision stamps profile and all documents correctly."""
        from app.api.v1.endpoints.staff import verify_teacher

        profile = _make_profile()
        staff = _make_staff()
        teacher_id = profile.user_id
        decision = _decision(VerificationStatus.APPROVED)

        # Mock DB: first execute (FOR UPDATE) returns locked profile,
        # second execute (re-fetch with user/docs) returns the updated profile.
        db = AsyncMock()
        locked_result = MagicMock()
        locked_result.scalar_one_or_none.return_value = profile

        profile_with_relations = MagicMock()
        profile_with_relations.user_id = teacher_id
        profile_with_relations.document_status = VerificationStatus.APPROVED
        profile_with_relations.documents = profile.documents
        profile_with_relations.user = MagicMock()

        refetch_result = MagicMock()
        refetch_result.scalar_one.return_value = profile_with_relations

        db.execute = AsyncMock(side_effect=[locked_result, refetch_result])
        db.add = MagicMock()
        db.flush = AsyncMock()

        background_tasks = MagicMock()
        background_tasks.add_task = MagicMock()

        await verify_teacher(
            teacher_id=teacher_id,
            body=decision,
            background_tasks=background_tasks,
            db=db,
            current_staff=staff,
        )

        assert profile.document_status == VerificationStatus.APPROVED
        assert profile.reviewed_by_id == staff.id
        assert profile.reviewed_at is not None

        for doc in profile.documents:
            assert doc.status == VerificationStatus.APPROVED
            assert doc.verified_by_id == staff.id
            assert doc.verified_at is not None

        background_tasks.add_task.assert_called_once_with(
            _emit_profile_verified, teacher_id, decision
        )

    @pytest.mark.asyncio
    async def test_reject_sets_remarks_on_documents(self):
        """REJECTED decision writes remarks to all documents."""
        from app.api.v1.endpoints.staff import verify_teacher

        profile = _make_profile()
        staff = _make_staff()
        teacher_id = profile.user_id
        decision = _decision(VerificationStatus.REJECTED, remarks="NID photo too blurry")

        db = AsyncMock()
        locked_result = MagicMock()
        locked_result.scalar_one_or_none.return_value = profile

        refetch_result = MagicMock()
        refetch_result.scalar_one.return_value = MagicMock(
            user_id=teacher_id,
            document_status=VerificationStatus.REJECTED,
            documents=profile.documents,
            user=MagicMock(),
        )
        db.execute = AsyncMock(side_effect=[locked_result, refetch_result])
        db.add = MagicMock()
        db.flush = AsyncMock()

        background_tasks = MagicMock()
        background_tasks.add_task = MagicMock()

        await verify_teacher(
            teacher_id=teacher_id,
            body=decision,
            background_tasks=background_tasks,
            db=db,
            current_staff=staff,
        )

        for doc in profile.documents:
            assert doc.remarks == "NID photo too blurry"
            assert doc.status == VerificationStatus.REJECTED

    @pytest.mark.asyncio
    async def test_raises_404_when_teacher_not_found(self):
        """TeacherNotFoundError when profile does not exist."""
        from app.api.v1.endpoints.staff import verify_teacher

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)

        with pytest.raises(TeacherNotFoundError):
            await verify_teacher(
                teacher_id=uuid.uuid4(),
                body=_decision(VerificationStatus.APPROVED),
                background_tasks=MagicMock(),
                db=db,
                current_staff=_make_staff(),
            )

    @pytest.mark.asyncio
    async def test_raises_409_when_already_reviewed(self):
        """ConflictError when profile is no longer PENDING (double-review guard)."""
        from app.api.v1.endpoints.staff import verify_teacher

        profile = _make_profile(doc_status=VerificationStatus.APPROVED)

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = profile
        db.execute = AsyncMock(return_value=result)

        with pytest.raises(ConflictError):
            await verify_teacher(
                teacher_id=profile.user_id,
                body=_decision(VerificationStatus.APPROVED),
                background_tasks=MagicMock(),
                db=db,
                current_staff=_make_staff(),
            )

    @pytest.mark.asyncio
    async def test_background_task_registered_before_return(self):
        """
        background_tasks.add_task is called inside the route (before the function
        returns), so DatabaseSessionManager commits first → task runs after response.
        """
        from app.api.v1.endpoints.staff import verify_teacher

        profile = _make_profile()
        staff = _make_staff()
        teacher_id = profile.user_id
        decision = _decision(VerificationStatus.APPROVED)

        db = AsyncMock()
        locked_result = MagicMock()
        locked_result.scalar_one_or_none.return_value = profile
        refetch_result = MagicMock()
        refetch_result.scalar_one.return_value = MagicMock(
            user_id=teacher_id,
            document_status=VerificationStatus.APPROVED,
            documents=[],
            user=MagicMock(),
        )
        db.execute = AsyncMock(side_effect=[locked_result, refetch_result])
        db.add = MagicMock()
        db.flush = AsyncMock()

        task_calls = []
        background_tasks = MagicMock()
        background_tasks.add_task = lambda fn, *args, **kwargs: task_calls.append((fn, args))

        await verify_teacher(
            teacher_id=teacher_id,
            body=decision,
            background_tasks=background_tasks,
            db=db,
            current_staff=staff,
        )

        assert len(task_calls) == 1
        fn, args = task_calls[0]
        assert fn is _emit_profile_verified
        assert args[0] == teacher_id
        assert args[1] is decision

    @pytest.mark.asyncio
    async def test_no_background_task_on_conflict(self):
        """Background task is NOT registered when 409 is raised."""
        from app.api.v1.endpoints.staff import verify_teacher

        profile = _make_profile(doc_status=VerificationStatus.REJECTED)

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = profile
        db.execute = AsyncMock(return_value=result)

        background_tasks = MagicMock()
        background_tasks.add_task = MagicMock()

        with pytest.raises(ConflictError):
            await verify_teacher(
                teacher_id=profile.user_id,
                body=_decision(VerificationStatus.APPROVED),
                background_tasks=background_tasks,
                db=db,
                current_staff=_make_staff(),
            )

        background_tasks.add_task.assert_not_called()


# ── 3. get_next_pending_teacher endpoint logic ────────────────────────────────

class TestGetNextPendingTeacher:

    @pytest.mark.asyncio
    async def test_returns_oldest_pending_profile(self):
        """Returns a single-element list containing the profile."""
        from app.api.v1.endpoints.staff import get_next_pending_teacher

        profile = _make_profile()

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = profile
        db.execute = AsyncMock(return_value=result)

        returned = await get_next_pending_teacher(db=db, current_staff=_make_staff())
        assert returned == [profile]

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_queue_empty(self):
        """Empty queue is a valid state — returns [] not an error."""
        from app.api.v1.endpoints.staff import get_next_pending_teacher

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)

        returned = await get_next_pending_teacher(db=db, current_staff=_make_staff())
        assert returned == []
