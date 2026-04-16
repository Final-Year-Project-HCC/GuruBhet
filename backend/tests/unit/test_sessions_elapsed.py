from datetime import datetime, timedelta, timezone

from app.api.v1.endpoints.sessions import _compute_elapsed_seconds


class DummySession:
    def __init__(self, created_at, actual_start_at=None):
        self.created_at = created_at
        self.actual_start_at = actual_start_at


def test_compute_elapsed_uses_actual_start_when_present():
    now = datetime.now(timezone.utc)
    created = now - timedelta(minutes=30)
    actual = now - timedelta(minutes=10)
    s = DummySession(created_at=created, actual_start_at=actual)

    elapsed = _compute_elapsed_seconds(s, now=now)
    assert int(elapsed) == 10 * 60


def test_compute_elapsed_falls_back_to_created():
    now = datetime.now(timezone.utc)
    created = now - timedelta(minutes=5)
    s = DummySession(created_at=created, actual_start_at=None)

    elapsed = _compute_elapsed_seconds(s, now=now)
    assert int(elapsed) == 5 * 60
