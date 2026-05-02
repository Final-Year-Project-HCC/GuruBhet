"""Unit tests for LiveKitTokenResponse schema enhancements.

Tests cover:
- leniency_minutes computed field correctness for various session durations
- new fields present in serialized output
- actual_start_at optional handling
"""
from datetime import datetime, UTC
from unittest.mock import patch

import pytest

from app.schemas.booking import LiveKitTokenResponse


def _make(session_duration_minutes: int, actual_start_at=None, **kwargs) -> LiveKitTokenResponse:
    return LiveKitTokenResponse(
        token="tok",
        room_name="session-abc",
        livekit_url="wss://example.com",
        session_duration_minutes=session_duration_minutes,
        actual_start_at=actual_start_at,
        **kwargs,
    )


class TestLeniencyMinutesComputed:
    """leniency_minutes = ceil(duration / 15) * LENIENCY_PER_15MIN"""

    def test_15_min_session(self):
        # ceil(15/15) * 5 = 1 * 5 = 5
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(15)
            assert r.leniency_minutes == 5

    def test_30_min_session(self):
        # ceil(30/15) * 5 = 2 * 5 = 10
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(30)
            assert r.leniency_minutes == 10

    def test_45_min_session(self):
        # ceil(45/15) * 5 = 3 * 5 = 15
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(45)
            assert r.leniency_minutes == 15

    def test_60_min_session(self):
        # ceil(60/15) * 5 = 4 * 5 = 20
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(60)
            assert r.leniency_minutes == 20

    def test_90_min_session(self):
        # ceil(90/15) * 5 = 6 * 5 = 30
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(90)
            assert r.leniency_minutes == 30

    def test_custom_leniency_per_15min(self):
        # ceil(30/15) * 3 = 2 * 3 = 6
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 3
            r = _make(30)
            assert r.leniency_minutes == 6

    def test_zero_leniency_per_15min(self):
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 0
            r = _make(30)
            assert r.leniency_minutes == 0


class TestActualStartAtField:
    def test_actual_start_at_none_by_default(self):
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(30)
        assert r.actual_start_at is None

    def test_actual_start_at_set(self):
        now = datetime(2024, 1, 15, 10, 0, 0, tzinfo=UTC)
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(30, actual_start_at=now)
        assert r.actual_start_at == now


class TestSerializationIncludesNewFields:
    def test_model_dump_includes_all_new_fields(self):
        now = datetime(2024, 1, 15, 10, 0, 0, tzinfo=UTC)
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(30, actual_start_at=now)
            data = r.model_dump()
            assert "actual_start_at" in data
            assert "session_duration_minutes" in data
            assert "leniency_minutes" in data
            assert data["session_duration_minutes"] == 30
            assert data["leniency_minutes"] == 10

    def test_camel_case_serialization(self):
        """Verify camelCase alias generator works for new fields."""
        now = datetime(2024, 1, 15, 10, 0, 0, tzinfo=UTC)
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(30, actual_start_at=now)
        data = r.model_dump(by_alias=True)
        assert "actualStartAt" in data
        assert "sessionDurationMinutes" in data
        assert "leniencyMinutes" in data

    def test_already_exists_preserved(self):
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(30, already_exists=True)
        assert r.already_exists is True

    def test_already_exists_defaults_false(self):
        with patch("app.schemas.booking.settings") as mock_settings:
            mock_settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN = 5
            r = _make(30)
        assert r.already_exists is False
