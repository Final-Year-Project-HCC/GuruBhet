from app.api.v1.endpoints.livekit import _session_id_from_room


def test_session_id_from_room():
    assert _session_id_from_room("session-abc123") == "abc123"
    assert _session_id_from_room("notasession") == "notasession"
    assert _session_id_from_room("") == ""
    assert _session_id_from_room(None) is None
