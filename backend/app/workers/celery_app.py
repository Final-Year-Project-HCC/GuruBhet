from celery import Celery
from celery.signals import worker_process_init
from app.core.config import settings

celery_app = Celery(
    "gurubhet",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.session_request_tasks",
        "app.tasks.livekit_tasks",
        "app.workers.payout_tasks",
        "app.workers.esewa_tasks",
        "app.workers.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kathmandu",
    enable_utc=True,
    beat_schedule={
        "weekly-payout": {
            "task": "app.workers.payout_tasks.process_weekly_payouts",
            "schedule": 604800,   # every 7 days in seconds
        },
        "check-no-shows": {
            "task": "app.workers.notification_tasks.check_no_shows",
            "schedule": 300,      # every 5 minutes
        },
        "monitor-orphaned-rooms": {
            "task": "app.tasks.livekit_tasks.monitor_orphaned_rooms",
            "schedule": 3600,     # every hour (in seconds)
        },
    },
)


@worker_process_init.connect
def init_db_connection(**kwargs):
    """Initialize the database connection when a worker process starts."""
    import asyncio
    from app.db.session import sessionmanager
    
    asyncio.run(sessionmanager.init())