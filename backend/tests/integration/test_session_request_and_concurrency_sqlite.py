import asyncio
import os
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.user import User
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.subject import StudyLevel, Board, Faculty, Subject
from app.models.booking import Booking, Session
from app.core.enums import UserRole, VerificationStatus, UnitType

DB_FILE = ".pytest_tmp.db"
SQLALCHEMY_SQLITE_URL = f"sqlite+aiosqlite:///{DB_FILE}"


@pytest.fixture
async def sqlite_engine():
    # ensure no leftover db
    try:
        os.remove(DB_FILE)
    except FileNotFoundError:
        pass

    engine = create_async_engine(SQLALCHEMY_SQLITE_URL, echo=False)
    async with engine.begin() as conn:
        # Create only the minimal set of tables required for these integration tests.
        def _create_min_tables(sync_conn):
            meta = Base.metadata
            needed = [
                "users",
                "student_profiles",
                "teacher_profiles",
                "study_levels",
                "boards",
                "faculties",
                "subjects",
                "bookings",
                "sessions",
            ]
            tables = [meta.tables[name] for name in needed if name in meta.tables]
            meta.create_all(bind=sync_conn, tables=tables)

        await conn.run_sync(_create_min_tables)
    yield engine
    async with engine.begin() as conn:
        def _drop_min_tables(sync_conn):
            meta = Base.metadata
            needed = [
                "users",
                "student_profiles",
                "teacher_profiles",
                "study_levels",
                "boards",
                "faculties",
                "subjects",
                "bookings",
                "sessions",
            ]
            tables = [meta.tables[name] for name in needed if name in meta.tables]
            meta.drop_all(bind=sync_conn, tables=tables)

        await conn.run_sync(_drop_min_tables)
    await engine.dispose()
    try:
        os.remove(DB_FILE)
    except FileNotFoundError:
        pass


@pytest.fixture
async def sqlite_db(sqlite_engine):
    factory = async_sessionmaker(bind=sqlite_engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def sqlite_client(sqlite_db):
    # create client and override the underlying FastAPI app dependency
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        wrapper = ac._transport.app
        # the socketio.ASGIApp stores the FastAPI app in `other_asgi_app`
        underlying = getattr(wrapper, "other_asgi_app", wrapper)
        underlying.dependency_overrides[get_db] = lambda: sqlite_db
        yield ac
        underlying.dependency_overrides.clear()


class DummySIO:
    def __init__(self):
        self.emitted = []

    async def emit_to_user(self, user_id, event, payload):
        self.emitted.append((str(user_id), event, payload))


@pytest.mark.asyncio
async def test_session_request_and_accept_flow_sqlite(sqlite_client, sqlite_db, monkeypatch):
    # create minimal subject tree
    sl = StudyLevel(name="G10")
    board = Board(name="B1")
    faculty = Faculty(board=board, study_level=sl, name="General", unit_type=UnitType.GRADE, total_units=1)
    subject = Subject(name="Math", faculty=faculty, unit_value=1)
    sqlite_db.add_all([sl, board, faculty, subject])
    await sqlite_db.flush()

    # users
    student = User(first_name="S", last_name="T", email=f"s{uuid4()}@x.com", password_hash="x", role=UserRole.STUDENT)
    teacher = User(first_name="T", last_name="R", email=f"t{uuid4()}@x.com", password_hash="x", role=UserRole.TEACHER)
    sqlite_db.add_all([student, teacher])
    await sqlite_db.flush()
    sqlite_db.add(StudentProfile(user_id=student.id))
    sqlite_db.add(TeacherProfile(user_id=teacher.id, document_status=VerificationStatus.APPROVED, is_payment_verified=True))

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
    sqlite_db.add(booking)
    await sqlite_db.commit()

    # monkeypatch external helpers imported by bookings endpoint
    pending = {}

    async def fake_set_pending(bid):
        pending[str(bid)] = True

    async def fake_get_pending(bid):
        return pending.get(str(bid))

    async def fake_clear_pending(bid):
        pending.pop(str(bid), None)

    async def fake_create_message(booking_id, teacher_id, student_id, db):
        class Msg:
            def __init__(self):
                self.id = uuid4()
        return Msg()

    monkeypatch.setattr("app.api.v1.endpoints.bookings.set_pending_session_key", fake_set_pending)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.get_pending_session_key", fake_get_pending)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.clear_pending_session_key", fake_clear_pending)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.create_session_request_message", fake_create_message)

    # patch socketio and livekit
    sio = DummySIO()
    monkeypatch.setattr("app.api.v1.endpoints.bookings.get_socketio_manager", lambda: sio)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.create_room", lambda *a, **k: f"room-{a[0]}")
    monkeypatch.setattr("app.api.v1.endpoints.bookings.generate_room_token", lambda **k: "tok")

    # set current user to teacher and request session
    from app.core.dependencies import get_current_user as dep_get_user
    underlying = sqlite_client._transport.app.other_asgi_app
    underlying.dependency_overrides[dep_get_user] = lambda: teacher
    resp = await sqlite_client.post(f"/api/v1/bookings/{booking.id}/request-session")
    assert resp.status_code == 200 and resp.json()["status"] == "ready"

    # accept as student
    underlying.dependency_overrides[dep_get_user] = lambda: student
    resp2 = await sqlite_client.post(f"/api/v1/bookings/{booking.id}/accept-session")
    assert resp2.status_code == 200
    body = resp2.json()
    assert body["already_exists"] in (False, True)


@pytest.mark.asyncio
async def test_concurrent_accepts_sqlite(sqlite_client, sqlite_db, monkeypatch):
    # create data similar to above but allow 2 sessions
    sl = StudyLevel(name="G11")
    board = Board(name="B2")
    faculty = Faculty(board=board, study_level=sl, name="General", unit_type=UnitType.GRADE, total_units=1)
    subject = Subject(name="Physics", faculty=faculty, unit_value=1)
    sqlite_db.add_all([sl, board, faculty, subject])
    await sqlite_db.flush()

    student = User(first_name="CS", last_name="U", email=f"cs{uuid4()}@x.com", password_hash="x", role=UserRole.STUDENT)
    teacher = User(first_name="CT", last_name="U", email=f"ct{uuid4()}@x.com", password_hash="x", role=UserRole.TEACHER)
    sqlite_db.add_all([student, teacher])
    await sqlite_db.flush()
    sqlite_db.add(StudentProfile(user_id=student.id))
    sqlite_db.add(TeacherProfile(user_id=teacher.id, document_status=VerificationStatus.APPROVED, is_payment_verified=True))

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
    sqlite_db.add(booking)
    await sqlite_db.commit()

    # monkeypatch pending key helpers and livekit
    pending = {str(booking.id): True}

    async def fake_get_pending(bid):
        return pending.get(str(bid))

    async def fake_clear_pending(bid):
        pending.pop(str(bid), None)

    monkeypatch.setattr("app.api.v1.endpoints.bookings.get_pending_session_key", fake_get_pending)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.clear_pending_session_key", fake_clear_pending)
    monkeypatch.setattr("app.api.v1.endpoints.bookings.create_room", lambda *a, **k: f"room-{a[0]}")
    monkeypatch.setattr("app.api.v1.endpoints.bookings.generate_room_token", lambda **k: "tok")

    # run N concurrent accepts
    from app.core.dependencies import get_current_user as dep_get_user
    underlying = sqlite_client._transport.app.other_asgi_app
    underlying.dependency_overrides[dep_get_user] = lambda: student

    async def do_accept():
        return await sqlite_client.post(f"/api/v1/bookings/{booking.id}/accept-session")

    # spawn 8 concurrent accept attempts
    tasks = [do_accept() for _ in range(8)]
    results = await asyncio.gather(*tasks)

    # all responses should be either 200 or 410
    assert all(r.status_code in (200, 410) for r in results)

    # check DB sessions count for booking
    res = await sqlite_db.execute(Session.__table__.select().where(Session.booking_id == booking.id))
    rows = res.fetchall()
    # should not exceed total_sessions
    assert len(rows) <= booking.total_sessions
