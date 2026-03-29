# Quick Reference: Session Completion Flow

## TL;DR

✅ **Problem Solved:** Session completion logic was scattered → Now centralized in one function  
✅ **Solution:** All paths (routes, Celery, webhook) call `handle_session_completion()`  
✅ **Benefit:** Atomic transactions, no duplication, consistent behavior

---

## The Function

```python
# Location: app/utils/livekit.py

async def handle_session_completion(
    session,           # The session being completed
    booking,           # The booking associated with session
    db,                # Database session
    completion_status, # COMPLETED | CANCELLED_BY_TEACHER | CANCELLED_BY_STUDENT
) -> None:
    # Does everything:
    # 1. Set status & timestamp
    # 2. Create transaction (if applicable)
    # 3. Update counters
    # 4. Increment experience
    # 5. Commit (critical data safe)
    # 6. Emit Socket.IO
    # 7. Schedule tasks
    # 8. Delete room
```

---

## Who Calls It

### Routes (3 ways)

```python
# Auto-complete: duration reached
await handle_session_completion(session, booking, db, SessionStatus.COMPLETED)

# Student accepts early completion
await handle_session_completion(session, booking, db, SessionStatus.COMPLETED)

# Cancel by teacher/student
await handle_session_completion(session, booking, db, SessionStatus.CANCELLED_BY_TEACHER)
# or
await handle_session_completion(session, booking, db, SessionStatus.CANCELLED_BY_STUDENT)
```

### Celery Task (1 way)

```python
# Session expired, Celery cleanup task runs
await handle_session_completion(session, booking, db, SessionStatus.COMPLETED)
```

### Webhook (safety net)

```python
# Only if route/task failed and status still IN_PROGRESS
if session.status == SessionStatus.IN_PROGRESS:
    await handle_session_completion(session, booking, db, SessionStatus.COMPLETED)
```

---

## What It Does

| Step | Action                 | Data Safe? | Can Fail?                |
| ---- | ---------------------- | ---------- | ------------------------ |
| 1    | Set status & timestamp | ❌         | ❌ No                    |
| 2    | Create transaction     | ❌         | ❌ No                    |
| 3    | Update counters        | ❌         | ❌ No                    |
| 4    | Increment experience   | ❌         | ❌ No                    |
| 5    | **COMMIT DATABASE**    | ✅ YES     | ❌ No (rollback if ✗)    |
| 6    | Emit Socket.IO         | ✅         | ✅ Yes (logged, ignored) |
| 7    | Schedule tasks         | ✅         | ✅ Yes (logged, ignored) |
| 8    | Delete room            | ✅         | ✅ Yes (logged, ignored) |

**Key Insight:** Critical data (1-4) is atomic. Non-critical operations (6-8) are best-effort.

---

## Transaction Logic

```python
if completion_status == COMPLETED:
    # ✅ Create transaction (teacher gets paid)
    # ✅ Update booking.completed_sessions
    # ✅ Increment teacher experience

elif completion_status == CANCELLED_BY_STUDENT:
    # ✅ Create transaction (teacher gets paid as penalty)
    # ✅ Update booking.cancelled_sessions
    # ✅ Increment teacher experience

elif completion_status == CANCELLED_BY_TEACHER:
    # ❌ NO transaction (teacher's own cancellation)
    # ✅ Update booking.cancelled_sessions
    # ✅ Increment teacher experience
```

---

## Execution Timeline

### Scenario: Normal Completion (Teacher Ends Session)

```
T=0:00:00
  └─ Teacher clicks "End Session"
     └─ Route: request_session_completion()
        └─ Calls: handle_session_completion(..., COMPLETED)
           ├─ Set status = COMPLETED ✓
           ├─ Create transaction ✓
           ├─ Update counters ✓
           ├─ Increment experience ✓
           ├─ Commit ✓ (DATA SAFE)
           ├─ Delete room (best effort)
           └─ Emit Socket.IO (best effort)

T=0:00:05
  └─ LiveKit room actually closes
     └─ room_finished webhook fires
        └─ Checks: status == IN_PROGRESS?
           └─ NO (already COMPLETED)
           └─ Logs: "Already processed"
           └─ Returns
```

### Scenario: Cleanup (Session Expires)

```
T=0:00:00
  └─ Session starts

T+duration+leniency
  └─ Celery cleanup task: _async_cleanup_expired_livekit_room()
     └─ Checks: status == IN_PROGRESS?
        └─ YES
        └─ Calls: handle_session_completion(..., COMPLETED)
           ├─ Set status = COMPLETED ✓
           ├─ Create transaction ✓
           ├─ Update counters ✓
           ├─ Increment experience ✓
           ├─ Commit ✓ (DATA SAFE)
           └─ Delete room + tasks (best effort)

T+duration+leniency+5s
  └─ room_finished webhook fires
     └─ Checks: status == IN_PROGRESS?
        └─ NO (already COMPLETED by Celery)
        └─ Logs: "Already processed"
```

### Scenario: Fallback (Routes Failed)

```
T=0:00:00
  └─ Session starts

T=0:30:00
  └─ Teacher clicks "End Session"
     └─ Route fails with network error ✗
        └─ Session status: still IN_PROGRESS

T+duration+leniency
  └─ Celery task tries to complete
     └─ Also fails ✗
     └─ Session status: still IN_PROGRESS

T+duration+leniency+10s
  └─ room_finished webhook fires
     └─ Checks: status == IN_PROGRESS?
        └─ YES (routes/tasks both failed)
        └─ Logs warning: "Fallback: completing session"
        └─ Calls: handle_session_completion(..., COMPLETED)
           ├─ Set status = COMPLETED ✓
           ├─ Create transaction ✓
           ├─ Update counters ✓
           ├─ Commit ✓ (DATA CONSISTENT!)
           └─ Deletes room + tasks
```

---

## Files Changed

| File                               | What Changed           | Why                        |
| ---------------------------------- | ---------------------- | -------------------------- |
| `app/utils/livekit.py`             | ➕ Added function      | New single source of truth |
| `app/api/v1/endpoints/sessions.py` | 🔄 Updated 3 routes    | All use common handler     |
| `app/tasks/livekit_tasks.py`       | 🔄 Updated Celery task | Calls common handler       |
| `app/api/v1/endpoints/livekit.py`  | 🔄 Updated webhook     | Now fallback only          |

---

## Key Guarantees

✅ **Consistency** - All critical data commits atomically  
✅ **Single Truth** - All paths use same logic  
✅ **No Duplicates** - Business logic in one place  
✅ **Idempotent** - Safe to call multiple times  
✅ **Resilient** - Routes + Celery + Webhook (fallback)  
✅ **Debuggable** - Webhook logs show if fallback used

---

## How to Verify

### Check Routes Work

```bash
# Test: Teacher completes session
POST /sessions/{id}/request-completion

# Test: Student accepts early
POST /sessions/{id}/accept-completion

# Test: Cancel session
POST /sessions/{id}/cancel
```

### Check Celery Works

```bash
# Monitor logs for cleanup task
docker logs <celery-container> | grep "cleanup_expired"
```

### Check Webhook Works

```bash
# Normal case: logs "already processed"
# Fallback case: logs "completing as fallback" (investigate!)
```

---

## Common Questions

**Q: What if webhook never arrives?**  
A: Celery task completes the session. Webhook just checks and logs.

**Q: What if routes fail but Celery works?**  
A: Celery completes it. Webhook sees it's done and logs "already processed".

**Q: What if everything fails?**  
A: Webhook completes it as fallback. You should investigate why routes/Celery failed.

**Q: Is it safe to call handle_session_completion() twice?**  
A: Yes. First call sets status. Second call sees status != IN_PROGRESS and returns early.

**Q: Where's the old \_complete_session() function?**  
A: Merged into handle_session_completion(). Removed code duplication.

---

## Monitoring

Watch these logs:

```
✅ NORMAL:
"Session {id} marked as COMPLETED"
"Already processed"

⚠️  INVESTIGATE:
"Fallback: completing session" (means routes/Celery failed)
"Failed to emit Socket.IO event" (non-critical, OK to log)
"Failed to delete room" (non-critical, OK to log)

❌ ERROR:
"Error handling session completion" (critical error, needs investigation)
```

---

## Deployment Checklist

- [ ] All code reviewed
- [ ] Tests pass (unit + integration)
- [ ] Deployed to staging
- [ ] Manual testing complete
- [ ] Logs monitored for fallbacks
- [ ] Ready for production

---

**See also:**

- `HANDLE_SESSION_COMPLETION_ARCHITECTURE.md` (detailed guide)
- `IMPLEMENTATION_COMPLETE.md` (what changed)
