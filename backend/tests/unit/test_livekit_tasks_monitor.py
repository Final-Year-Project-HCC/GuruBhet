import asyncio
from datetime import datetime, timezone, timedelta
import pytest

from app.tasks.livekit_tasks import _async_monitor_orphaned_rooms


class DummyRoom:
    def __init__(self, name, num_participants, creation_time_ms):
        self.name = name
        self.num_participants = num_participants
        self.creation_time = creation_time_ms


class DummyRoomsResp:
    def __init__(self, rooms):
        self.rooms = rooms


class DummyAPI:
    class room:
        @staticmethod
        async def list_rooms(req):
            return DummyRoomsResp([
                DummyRoom(
                    name="session-old",
                    num_participants=0,
                    creation_time_ms=int((datetime.now(timezone.utc) - timedelta(hours=3)).timestamp() * 1000),
                ),
                DummyRoom(
                    name="session-active",
                    num_participants=2,
                    creation_time_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                ),
                DummyRoom(
                    name="other-room",
                    num_participants=0,
                    creation_time_ms=int((datetime.now(timezone.utc) - timedelta(hours=5)).timestamp() * 1000),
                ),
            ])


@pytest.mark.asyncio
async def test_monitor_orphaned_rooms_calls_end_room(monkeypatch):
    called = []

    async def dummy_end_room(name):
        called.append(name)

    # Patch get_livekit_api to return our dummy API
    monkeypatch.setattr("app.tasks.livekit_tasks.get_livekit_api", lambda: DummyAPI())
    monkeypatch.setattr("app.tasks.livekit_tasks.end_room", dummy_end_room)

    await _async_monitor_orphaned_rooms()

    # Should have called end_room for 'session-old' only (other-room doesn't start with 'session-')
    assert any("session-old" in c for c in called)
