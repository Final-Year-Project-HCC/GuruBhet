"""Celery configuration and application instance."""
from celery import Celery
from celery.signals import worker_process_init
from app.core.config import settings

# Create Celery app instance
celery_app = Celery(
    "gurubhet",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# ── Celery Configuration ─────────────────────────────────────────────────────
celery_app.conf.update(
    # ── Serialization ───────────────────────────────────────────────────
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    
    # ── Timezone ─────────────────────────────────────────────────────────
    timezone="Asia/Kathmandu",
    enable_utc=True,
    
    # ── Task Configuration ───────────────────────────────────────────────
    task_track_started=True,           # Track when tasks start
    task_time_limit=30 * 60,           # Hard time limit: 30 minutes
    task_soft_time_limit=25 * 60,      # Soft time limit: 25 minutes (gives time to cleanup)
    
    # ── Retry Configuration ──────────────────────────────────────────────
    task_autoretry_for=(Exception,),   # Auto-retry on any exception
    task_max_retries=3,                # Max 3 retry attempts
    task_default_retry_delay=60,       # Wait 60 seconds before retry
    
    # ── Worker Configuration ─────────────────────────────────────────────
    worker_prefetch_multiplier=1,      # Prefetch only 1 task at a time
    worker_max_tasks_per_child=1000,   # Restart worker after 1000 tasks
    
    # ── Result Backend ───────────────────────────────────────────────────
    result_expires=3600,               # Results expire after 1 hour
    result_backend_transport_options={
        "retry_on_timeout": True,
    },
    
    # ── Beat Scheduler (Periodic Tasks) ──────────────────────────────────
    beat_schedule={
        # Notifications
        "check-session-no-shows": {
            "task": "app.tasks.notification_tasks.check_session_no_shows",
            "schedule": 300,  # Every 5 minutes
            "options": {"expires": 280},
        },
        "send-session-reminders": {
            "task": "app.tasks.notification_tasks.send_session_reminders",
            "schedule": 1800,  # Every 30 minutes
            "options": {"expires": 1780},
        },
        
        # Payments & Payouts
        "process-weekly-payouts": {
            "task": "app.tasks.payout_tasks.process_weekly_payouts",
            "schedule": 604800,  # Every 7 days
            "options": {"expires": 604700},
        },
        "process-failed-payments": {
            "task": "app.tasks.payment_tasks.retry_failed_payments",
            "schedule": 3600,  # Every hour
            "options": {"expires": 3500},
        },
        
        # Cleanup
        "cleanup-old-notifications": {
            "task": "app.tasks.cleanup_tasks.cleanup_old_notifications",
            "schedule": 86400,  # Every day
            "options": {"expires": 86300},
        },
        "cleanup-unconfirmed-uploads": {
            "task": "app.tasks.cleanup_tasks.cleanup_unconfirmed_uploads",
            "schedule": 3600,  # Every hour
            "options": {"expires": 3500},
        },
        
        # LiveKit monitoring
        "monitor-orphaned-rooms": {
            "task": "app.tasks.livekit_tasks.monitor_orphaned_rooms",
            "schedule": 3600,  # Every hour
            "options": {"expires": 3500},
        },
    },
)

# ── Import Task Modules ──────────────────────────────────────────────────────
# This ensures tasks are discovered when Celery app starts
celery_app.autodiscover_tasks(["app.tasks"])


# ── Signal Handlers ──────────────────────────────────────────────────────────
@worker_process_init.connect
def init_worker_process(**kwargs):
    """Initialize resources bound to the worker's thread-local event loop."""
    from app.db.session import sessionmanager
    from app.utils.livekit import init_livekit
    from app.core.task_runner import run_async
    
    run_async(sessionmanager.init())
    run_async(init_livekit())


@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery setup."""
    print(f"Request: {self.request!r}")
