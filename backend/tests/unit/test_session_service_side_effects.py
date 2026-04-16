import asyncio
import pytest
from app.services.session_service import _run_side_effects


class DummySIO:
    def __init__(self):
        self.emitted = []

    async def emit_to_user(self, user_id, event, payload):
        self.emitted.append((user_id, event, payload))


@pytest.mark.asyncio
async def test_run_side_effects_emits_and_ends_room(monkeypatch):
    sio = DummySIO()
    # Patch app.core.socketio.get_socketio_manager to return our sio
    import app.core.socketio as core_sio
    monkeypatch.setattr(core_sio, "get_socketio_manager", lambda: sio)

    called = []

    async def dummy_end_room(room_name):
        called.append(room_name)

    # Patch the livekit end_room used by the service
    import app.utils.livekit as livekit_mod
    monkeypatch.setattr(livekit_mod, "end_room", dummy_end_room)

    await _run_side_effects("123", "student-1", "teacher-1", object())

    # socket emits: two calls (student and teacher)
    assert len(sio.emitted) == 2
    # end_room called with session-<id>
    assert called == ["session-123"]
