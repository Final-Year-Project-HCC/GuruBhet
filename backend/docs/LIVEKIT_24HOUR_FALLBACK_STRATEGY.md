# LiveKit 24-Hour Fallback Strategy

## Overview

This document explains the recommended approach for LiveKit room lifecycle management using a **24-hour empty_timeout as a fallback**, with Celery tasks as the primary controller of room deletion and `room_finished` event emission.

## Problem Solved

Previously, the empty_timeout was set to match the session duration + leniency, which caused:

- Potential race conditions between empty_timeout and Celery task
- Ambiguous room closure behavior (was it the timeout or the task?)
- Difficult debugging when rooms behaved unexpectedly

## Solution Architecture

### Three Mechanisms Working Together

```
┌─────────────────────────────────────────────────────────┐
│  LiveKit Room Lifecycle Management                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PRIMARY: Celery Scheduled Task                          │
│  ├─ Triggers at: duration + leniency                    │
│  ├─ Calls: end_room() to delete room explicitly         │
│  ├─ Ensures: room_finished event emitted predictably    │
│  └─ Retries: 3 times with exponential backoff           │
│                                                          │
│  SECONDARY: Monitoring Task                              │
│  ├─ Runs: Every hour (Celery Beat)                      │
│  ├─ Checks: For orphaned rooms (empty > 2 hours)        │
│  ├─ Alerts: If cleanup task likely failed               │
│  └─ Helps: Identify issues early                        │
│                                                          │
│  FALLBACK: 24-Hour Empty Timeout                         │
│  ├─ Configured: In create_room()                        │
│  ├─ Activates: Only if room becomes empty AND           │
│  │             Celery hasn't deleted it yet             │
│  ├─ Purpose: Ultimate safety net                        │
│  └─ Duration: 86400 seconds (24 hours)                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Flow Diagram

```
Session Created
    ↓
accept_session_request()
    ├─ Create room with empty_timeout = 24 hours
    ├─ Calculate: timeout = duration + leniency
    └─ Schedule Celery task with countdown = timeout ✓

At T + (duration + leniency) minutes:
    ↓
Celery Task Executes
    ├─ cleanup_expired_livekit_room(session_id)
    ├─ Calls end_room() to delete room
    ├─ Emits "room_finished" webhook
    └─ Marks session COMPLETED ✓

At T + (duration + leniency) + 1 second:
    ↓
LiveKit "room_finished" Webhook
    ├─ Received by /api/v1/livekit/webhook
    └─ Updates session (idempotent) ✓

Monitoring (Every Hour):
    ↓
monitor_orphaned_rooms()
    ├─ Lists all rooms from LiveKit
    ├─ Checks: empty for > 2 hours?
    └─ Alerts: if cleanup task failed ✓

If Celery Fails (Day 2):
    ↓
24-Hour Empty Timeout
    ├─ Room becomes empty (both disconnected)
    ├─ Timeout triggers after 24 hours
    └─ Fallback cleanup occurs ✓
```

## Configuration

### 1. Settings (`app/core/config.py`)

```python
class Settings(BaseSettings):
    # ...existing settings...

    # LiveKit
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    LIVEKIT_URL: str
    LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN: int  # e.g., 2 minutes per 15-min block
    LIVEKIT_EMPTY_TIMEOUT_SECONDS: int = 86400    # 24 hours fallback
```

### 2. Celery Configuration (`app/workers/celery_app.py`)

```python
celery_app.conf.beat_schedule = {
    "monitor-orphaned-rooms": {
        "task": "app.tasks.livekit_tasks.monitor_orphaned_rooms",
        "schedule": 3600,  # Every hour in seconds
    },
    # ...other tasks...
}
```

### 3. Room Creation (`app/utils/livekit.py`)

```python
async def create_room(session_id: str, session_duration_minutes: int) -> str:
    """
    Create a LiveKit room with 24-hour empty_timeout as fallback.

    The empty_timeout does NOT compete with the scheduled task because:
    1. Celery task runs at duration + leniency (primary)
    2. Empty timeout only matters if room is still empty after 24 hours (fallback)
    3. In normal operation, Celery task always runs first
    """
    room_name = f"session-{session_id}"

    await get_livekit_api().room.create_room(
        api.CreateRoomRequest(
            name=room_name,
            empty_timeout=settings.LIVEKIT_EMPTY_TIMEOUT_SECONDS,  # 24 hours
            max_participants=2,
        )
    )
    return room_name
```

## Tasks

### Primary: cleanup_expired_livekit_room

**When**: Scheduled when student accepts session  
**Countdown**: duration + leniency  
**What**: Deletes room, marks session COMPLETED

```python
@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def cleanup_expired_livekit_room(self, session_id: str):
    """Delete LiveKit room after session expires."""
    asyncio.run(_async_cleanup_expired_livekit_room(session_id))
```

**Retries**: Exponential backoff up to 3 times

- Retry 1: 60s later
- Retry 2: 120s later (60 × 2²)
- Retry 3: 240s later (60 × 2³)

### Secondary: monitor_orphaned_rooms

**When**: Every hour (Celery Beat schedule)  
**What**: Checks for empty rooms > 2 hours old

```python
@celery_app.task(bind=True, max_retries=3)
def monitor_orphaned_rooms(self):
    """Check for rooms that have been empty for > 2 hours."""
    asyncio.run(_async_monitor_orphaned_rooms())
```

**Alerts**: Logs warning if room:

- Has zero participants (empty)
- Been in LiveKit for > 2 hours
- Should have been deleted by cleanup task

## Example Timelines

### Normal Case: 30-minute session

```
T+0:      Session created, room created, cleanup scheduled
          ├─ empty_timeout = 86400s (24 hours)
          ├─ Cleanup task scheduled for T+34 minutes
          └─ (2 blocks × 2 min leniency = 4 min buffer)

T+15:     Teacher and student join room
          ├─ Room: 2 participants
          └─ empty_timeout timer: Not reset (still running)

T+25:     Both disconnect
          ├─ Room: 0 participants
          ├─ empty_timeout: Would trigger at T+24 hours
          └─ Cleanup task: Still scheduled for T+34

T+34:     Celery task executes
          ├─ Calls end_room(room_name)
          ├─ room_finished webhook emitted
          └─ Session marked COMPLETED ✓

T+35:     Webhook arrives
          ├─ Session already COMPLETED (idempotent)
          └─ No-op ✓
```

### Edge Case: Celery Task Fails

```
T+0:      Same as above
...
T+34:     Celery task fails (e.g., LiveKit API unreachable)
          ├─ Logs error
          ├─ Schedules retry in 60s
          └─ Room still exists in LiveKit

T+35:     Retry 1 executes
          ├─ Still fails
          ├─ Schedules retry in 120s
          └─ Room still exists

T+37:     Retry 2 executes
          ├─ Fails again
          ├─ Schedules retry in 240s
          └─ Room still exists

T+41:     Retry 3 executes and succeeds
          ├─ Room deleted
          └─ room_finished emitted ✓

Meanwhile:
T+60:     monitor_orphaned_rooms() task runs
          ├─ No alert yet (room not 2 hours old)
          └─ Continues running

If all retries fail by T+2 hours:
T+120:    monitor_orphaned_rooms() runs
          ├─ Finds room empty for > 2 hours
          ├─ Logs alert: "Orphaned room detected"
          └─ Ops team alerted to investigate

At T+24 hours:
T+1440:   empty_timeout triggers
          ├─ LiveKit closes room automatically
          ├─ room_finished emitted (final fallback)
          └─ Session eventually completes
```

## Monitoring & Alerting

### Logs to Watch

```bash
# Task scheduled
grep "Scheduled LiveKit room cleanup" backend.log

# Task succeeded
grep "LiveKit room cleanup completed" backend.log

# Task failed (before retry)
grep "Error cleaning up LiveKit room" backend.log

# Orphaned room detected
grep "Orphaned room detected" backend.log
```

### Key Metrics

| Metric               | Target | Alert If |
| -------------------- | ------ | -------- |
| Task success rate    | > 99%  | < 95%    |
| Cleanup latency      | < 60s  | > 300s   |
| Orphaned rooms       | 0      | > 0      |
| Retry rate           | < 1%   | > 5%     |
| Fallback activations | 0      | > 0      |

### Alert Rules

```yaml
- name: "LiveKit Cleanup Task Failing"
  condition: "error_rate > 5% in last 10 minutes"
  action: "Page on-call engineer"

- name: "Orphaned Rooms Detected"
  condition: "orphaned_room_count > 0"
  action: "Create incident, notify ops team"

- name: "Fallback Timeout Activating"
  condition: "room_finished from empty_timeout > 0"
  action: "Investigate Celery/task failures"
```

## Files Modified

| File                               | Changes                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `app/core/config.py`               | Added `LIVEKIT_EMPTY_TIMEOUT_SECONDS = 86400`                      |
| `app/utils/livekit.py`             | Changed to use 24-hour empty_timeout instead of calculated timeout |
| `app/tasks/livekit_tasks.py`       | Added cleanup and monitoring tasks (NEW)                           |
| `app/workers/celery_app.py`        | Added task module include and beat schedule                        |
| `app/api/v1/endpoints/bookings.py` | Added task scheduling in accept_session_request()                  |

## Benefits of This Approach

✅ **Crystal clear intent** - empty_timeout is obviously a safety net  
✅ **Single source of truth** - Celery task controls lifecycle  
✅ **Easy to debug** - If room lingers, you know task failed  
✅ **Built-in monitoring** - Hourly check for orphaned rooms  
✅ **Defense in depth** - Primary, secondary, and fallback mechanisms  
✅ **Production ready** - Handles all failure scenarios  
✅ **Observable** - Comprehensive logging for all events

## Testing

### Manual Test: Verify Cleanup Task Runs

```bash
# 1. Create a session with 1-minute duration (for quick testing)
curl -X POST http://localhost:8000/api/v1/bookings/{booking_id}/accept-session

# 2. Check that task was scheduled
redis-cli KEYS "celery*"

# 3. Wait 1 minute + leniency
sleep 90

# 4. Verify in logs:
# "✅ LiveKit room cleanup completed for session [id]"

# 5. Verify room deleted from LiveKit
# Session.livekit_room_name should be gone, or room shouldn't be in LiveKit API response
```

### Monitor Task Execution

```bash
# Watch Celery worker logs
celery -A app.workers.celery_app worker --loglevel=info

# In another terminal, check scheduled tasks
redis-cli LRANGE celery 0 -1

# Check task results (if result backend enabled)
redis-cli KEYS "celery-task-meta-*"
```

## Troubleshooting

### "Room not found" errors in logs

**Cause**: Room already deleted (possibly by another process)  
**Action**: Idempotent - safe to ignore

### "Orphaned room detected" alerts

**Cause**: Cleanup task failed and retries also failed  
**Action**:

1. Check Celery worker logs for errors
2. Verify LiveKit API connectivity
3. Check database for stuck sessions
4. Manually delete room if needed

### High cleanup latency

**Cause**: Celery workers overloaded  
**Action**:

1. Scale up Celery workers
2. Check Redis connectivity
3. Monitor task queue depth

## Future Improvements

1. **Custom monitoring dashboard** - Real-time view of room lifecycle
2. **Automatic cleanup** - Manual deletion endpoint for stuck rooms
3. **Metrics collection** - Prometheus/Datadog integration
4. **Custom alerts** - Slack/PagerDuty integration
5. **Rate limiting** - Batch cleanup to avoid overwhelming LiveKit API

## References

- LiveKit Documentation: https://docs.livekit.io/
- Celery Documentation: https://docs.celeryproject.io/
- LiveKit Python SDK: https://github.com/livekit/python-sdk
