# Celery Commands for GuruBhet

Updated commands after moving from `app.workers` to `app.celery`.

## Start Worker

```bash
poetry run celery -A app.celery worker --loglevel=info
```

## Start Beat Scheduler

```bash
poetry run celery -A app.celery beat --loglevel=info
```

## Start Flower (Monitoring Dashboard)

```bash
poetry run celery -A app.celery flower
```

Access Flower at: `http://localhost:5555`

---

## Run All Services (in separate terminals)

**Terminal 1 - Worker:**

```bash
poetry run celery -A app.celery worker --loglevel=info
```

**Terminal 2 - Beat:**

```bash
poetry run celery -A app.celery beat --loglevel=info
```

**Terminal 3 - Flower:**

```bash
poetry run celery -A app.celery flower
```

**Terminal 4 - FastAPI Backend:**

```bash
poetry run uvicorn app.main:app --reload
```

---

## Previous Commands (Deprecated)

These are the old commands that should NO LONGER be used:

```bash
# OLD - Do not use
poetry run celery -A app.workers.celery_app worker --loglevel=info
poetry run celery -A app.workers.celery_app beat --loglevel=info
```

---

## Maintenance Commands

### Purge Old Redis Queue

Clear all pending tasks from Redis (useful when migrating or resetting):

```bash
poetry run celery -A app.celery purge
```

(Answer `y` when prompted)

### Clear Beat Schedule

Reset the beat scheduler (clears old scheduled tasks):

```bash
rm celerybeat-schedule*
```

Then restart beat to recreate the schedule with new task names
