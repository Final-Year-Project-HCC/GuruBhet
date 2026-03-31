"""Task initialization and Celery app import."""
from app.celery import celery_app

# ── Explicit Task Module Imports ─────────────────────────────────────────────
# These must be imported to ensure Celery discovers and registers the tasks.
# Without these, tasks may fail with NotRegistered errors.
from app.tasks import (
    cleanup_tasks,
    esewa_tasks,
    livekit_tasks,
    media_tasks,
    notification_tasks,
    payment_tasks,
    payout_tasks,
    session_request_tasks,
)

__all__ = [
    "celery_app",
    "cleanup_tasks",
    "esewa_tasks",
    "livekit_tasks",
    "media_tasks",
    "notification_tasks",
    "payment_tasks",
    "payout_tasks",
    "session_request_tasks",
]
