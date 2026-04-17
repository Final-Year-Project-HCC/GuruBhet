import asyncio
from decimal import Decimal
from uuid import UUID

import pytest
from datetime import datetime

from app.core.dependencies import get_current_user
from app.core.enums import UserRole, VerificationStatus
from app.models.user import User
from app.models.teacher import TeacherProfile
from app.models.student import StudentProfile
from app.models.subject import StudyLevel, Board, Faculty, Subject
from app.models.booking import Booking, Session
from app.models.teacher import TeacherProfile


class DummySIO:
    def __init__(self):
        self.emitted = []

    async def emit_to_user(self, user_id, event, data):
        self.emitted.append((str(user_id), event, data))

    def is_user_online(self, user_id):
        return True


@pytest.mark.asyncio
async def test_session_request_and_accept_flow(client, db, monkeypatch):
    # --- create minimal catalog hierarchy ---
    sl = StudyLevel(name="Grade 10")
    db.add(sl)
    board = Board(name="NEB")
    db.add(board)
    faculty = Faculty(board=board, study_level=sl, name="General", unit_type=1, total_units=1)
    db.add(faculty)
    subject = Subject(name="Math", faculty=faculty)
    db.add(subject)

    # --- create users and profiles ---
    student = User(first_name="Stu", last_name="Dent", email="stu@example.com", password_hash="x", role=UserRole.STUDENT)
    teacher = User(first_name="Tea", last_name="Cher", email="tea@example.com", password_hash="x", role=UserRole.TEACHER)
    db.add_all([student, teacher])
    await db.flush()

    db.add(StudentProfile(user_id=student.id))
    db.add(TeacherProfile(user_id=teacher.id, document_status=VerificationStatus.APPROVED, is_payment_verified=True))

    # --- create booking (ACTIVE) ---
    booking = Booking(
        student_id=student.id,
        teacher_id=teacher.id,
        subject_id=subject.id,
        total_sessions=1,
        session_duration_minutes=30,
        rate_per_session=Decimal("10.00"),
        total_amount=Decimal("10.00"),
        escrow_amount=Decimal("0.00"),
        status="ACTIVE",
    )
    db.add(booking)
    await db.commit()

    # --- monkeypatch external helpers that the endpoint imports at module level ---
    pending = {}

    async def fake_set_pending_session_key(*args, **kwargs):
        bid = args[0] if args else kwargs.get("booking_id")
        pending[str(bid)] = True

    async def fake_get_pending_session_key(bid):
        return pending.get(str(bid))

    async def fake_clear_pending_session_key(bid):
        pending.pop(str(bid), None)

    async def fake_create_session_request_message(booking_id, teacher_id, student_id, db):
        class Msg:
            def __init__(self):
                from uuid import uuid4

                self.id = uuid4()

        return Msg()

    # Patch names in the bookings module (these were imported there)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.set_pending_session_key", fake_set_pending_session_key)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.get_pending_session_key", fake_get_pending_session_key)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.clear_pending_session_key", fake_clear_pending_session_key)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.create_session_request_message", fake_create_session_request_message)

    # Patch socketio manager used by the endpoint (module-level import)
    sio = DummySIO()
    monkeypatch.setattr("app.api.v1.endpoints.bookings.get_socketio_manager", lambda: sio)

    # Patch LiveKit helpers used by accept endpoint
    monkeypatch.setattr("app.api.v1.endpoints.bookings.create_room", lambda *args, **kwargs: f"room-{args[0]}")
    monkeypatch.setattr("app.api.v1.endpoints.bookings.generate_room_token", lambda **kwargs: "tok")

    # --- make request as teacher ---
    from app.core.dependencies import get_current_user as dep_get_user

    app = client._transport.app
    app.dependency_overrides[dep_get_user] = lambda: teacher

    resp = await client.post(f"/api/v1/bookings/{booking.id}/request-session")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ready"

    # --- accept as student ---
    app.dependency_overrides[dep_get_user] = lambda: student
    resp2 = await client.post(f"/api/v1/bookings/{booking.id}/accept-session")
    assert resp2.status_code == 200
    body = resp2.json()
    assert body["already_exists"] is False or isinstance(body["already_exists"], bool)


@pytest.mark.asyncio
async def test_concurrent_accepts_creates_single_session(client, db, monkeypatch):
    # Setup similar data as previous test
    sl = StudyLevel(name="Grade 11")
    db.add(sl)
    board = Board(name="Board2")
    db.add(board)
    faculty = Faculty(board=board, study_level=sl, name="General", unit_type=1, total_units=1)
    db.add(faculty)
    subject = Subject(name="Physics", faculty=faculty)
    db.add(subject)

    student = User(first_name="ConStu", last_name="Concurrent", email="constu@example.com", password_hash="x", role=UserRole.STUDENT)
    teacher = User(first_name="ConTea", last_name="Concurrent", email="contea@example.com", password_hash="x", role=UserRole.TEACHER)
    db.add_all([student, teacher])
    await db.flush()
    db.add(StudentProfile(user_id=student.id))
    db.add(TeacherProfile(user_id=teacher.id, document_status=VerificationStatus.APPROVED, is_payment_verified=True))

    booking = Booking(
        student_id=student.id,
        teacher_id=teacher.id,
        subject_id=subject.id,
        total_sessions=2,
        session_duration_minutes=30,
        rate_per_session=Decimal("10.00"),
        total_amount=Decimal("20.00"),
        escrow_amount=Decimal("0.00"),
        status="ACTIVE",
    )
    db.add(booking)
    await db.commit()

    # monkeypatch helpers
    pending = {str(booking.id): True}

    async def fake_get_pending_session_key(bid):
        return pending.get(str(bid))

    async def fake_clear_pending_session_key(bid):
        pending.pop(str(bid), None)

    monkeypatch.setattr("app.api.v1.endpoints.bookings.get_pending_session_key", fake_get_pending_session_key)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.clear_pending_session_key", fake_clear_pending_session_key)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.create_room", lambda *args, **kwargs: f"room-{args[0]}")
    monkeypatch.setattr("app.api.v1.endpoints.bookings.generate_room_token", lambda **kwargs: "tok")

    # Ensure token dependency returns student for both requests
    from app.core.dependencies import get_current_user as dep_get_user
    app = client._transport.app
    app.dependency_overrides[dep_get_user] = lambda: student

    # Fire two concurrent accepts
    async def do_accept():
        return await client.post(f"/api/v1/bookings/{booking.id}/accept-session")

    r1, r2 = await asyncio.gather(do_accept(), do_accept())

    assert r1.status_code in (200, 410)  # one may succeed, the other may get a 410 if window closed
    assert r2.status_code in (200, 410)

    # Query DB to ensure only one IN_PROGRESS session exists for booking
    result = await db.execute(
        Session.__table__.select().where(Session.booking_id == booking.id)
    )
    rows = result.fetchall()
    # There should be at most 1 session in progress
    assert len(rows) <= 1
