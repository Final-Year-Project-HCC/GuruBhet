# Session Completion Flow - Code Reference

## File: app/api/v1/endpoints/sessions.py

Complete implementation with all three new endpoints.

### Imports (Added)

```python
from app.db.redis import cache_set, cache_get, cache_delete
```

### Endpoint 1: Request Session Completion

```python
@router.post("/{session_id}/request-session-completion", response_model=SessionRead)
async def request_session_completion(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Teacher requests to complete a session prematurely or at the end of duration.

    Flow:
    1. If session duration has been reached + leniency time: Session is completed immediately
    2. If session duration not reached: Redis key is set, socket event sent to student for approval
    3. If Redis key already exists: Request fails with 409
    """
    # Implementation details shown in sessions.py
```

**Key Steps**:

1. Verify teacher is caller
2. Check session is IN_PROGRESS
3. Check session has actually started
4. Calculate elapsed time and leniency threshold
5. If threshold reached: Auto-complete, emit session-ended
6. If premature: Check Redis key, create if not exists, emit request event
7. Return 409 if request already pending

---

### Endpoint 2: Accept Session Completion

```python
@router.post("/{session_id}/accept-session-completion", response_model=SessionRead)
async def accept_session_completion(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Student accepts the teacher's request for premature session completion.

    Flow:
    1. Check Redis key exists (teacher actually requested premature completion)
    2. Complete the session
    3. Remove Redis key
    4. Emit session-ended event to both teacher and student
    """
    # Implementation details shown in sessions.py
```

**Key Steps**:

1. Verify student is caller
2. Check session is IN_PROGRESS
3. Check Redis key exists (400 if not)
4. Mark session as COMPLETED
5. Update booking counters
6. Create SESSION_RELEASE transaction
7. Delete Redis key
8. Emit session-ended event
9. Trigger Celery tasks

---

### Endpoint 3: Reject Session Completion

```python
@router.post("/{session_id}/reject-session-completion", response_model=SessionRead)
async def reject_session_completion(session_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Student rejects the teacher's request for premature session completion.

    Flow:
    1. Check Redis key exists
    2. Remove Redis key
    3. Emit premature-session-completion-rejected event to teacher
    """
    # Implementation details shown in sessions.py
```

**Key Steps**:

1. Verify student is caller
2. Check session is IN_PROGRESS
3. Check Redis key exists (400 if not)
4. Delete Redis key
5. Emit rejection event to teacher
6. Session remains IN_PROGRESS (continues)

---

## Code Patterns Used

### 1. Authorization Check

```python
if current_user.id != booking.teacher_id:
    raise HTTPException(status_code=403, detail="Only the teacher can request session completion")
```

### 2. Redis Key Check

```python
redis_key = f"premature_session_completion:{session_id}"
existing_request = await cache_get(redis_key)

if existing_request:
    raise HTTPException(
        status_code=409,
        detail="A premature session completion request already exists for this session",
    )
```

### 3. Redis Key Creation

```python
await cache_set(
    redis_key,
    {"session_id": str(session_id), "requested_at": now.isoformat()},
    ttl=60
)
```

### 4. Socket.IO Event Emission

```python
try:
    from app.core.socketio import sio
    await sio.emit(
        "session-ended",
        {
            "session_id": str(session_id),
            "booking_id": str(booking.id),
            "duration_seconds": int(elapsed_seconds),
            "completed_at": now.isoformat(),
        },
        room=session.livekit_room_name,  # Broadcast to everyone in room
    )
except Exception:
    pass  # Socket.IO may not be available in all contexts
```

### 5. Duration Calculation

```python
now = datetime.now(tz=timezone.utc)
elapsed_seconds = (now - session.actual_start_at).total_seconds()

# Calculate leniency in seconds
session_duration_minutes = booking.session_duration_minutes
leniency_minutes_per_15min = settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN
total_leniency_minutes = (session_duration_minutes / 15) * leniency_minutes_per_15min
total_leniency_seconds = total_leniency_minutes * 60

# Required duration in seconds
required_duration_seconds = session_duration_minutes * 60

# Check if session duration + leniency has been reached
if elapsed_seconds >= (required_duration_seconds + total_leniency_seconds):
    # Auto-complete
else:
    # Premature request
```

### 6. Session Completion

```python
session.status = SessionStatus.COMPLETED
session.actual_end_at = now
await db.flush()

# Update booking counters
booking.completed_sessions += 1
if booking.completed_sessions >= booking.total_sessions:
    booking.status = BookingStatus.COMPLETED
await db.flush()

# Increment teacher experience
from app.repositories.teacher_subject_repo import TeacherSubjectRepository
ts_repo = TeacherSubjectRepository(db)
await ts_repo.increment_completed_sessions(
    teacher_id=booking.teacher_id,
    subject_id=booking.subject_id,
)

# Create transaction
from app.models.payment import Transaction
from app.core.enums import TransactionType, TransactionReason
db.add(Transaction(
    user_id=booking.teacher_id,
    amount=booking.rate_per_session,
    type=TransactionType.CREDIT,
    reason=TransactionReason.SESSION_RELEASE,
    booking_id=booking.id,
))
await db.flush()

# Cleanup
if session.livekit_room_name:
    try:
        await end_room(session.livekit_room_name)
    except Exception:
        pass

from app.utils.livekit import clear_pending_session_key
await clear_pending_session_key(str(booking.id))
await cache_delete(f"session_room_state:{session_id}")

# Emit events and trigger tasks (see above patterns)
```

---

## Environment Configuration

### .env

```env
# Session completion leniency (minutes per 15-minute block)
LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN=2
```

### Calculate Leniency for Your Duration

```python
def calculate_leniency(session_duration_minutes: int, leniency_per_15min: int) -> int:
    """Returns total leniency in minutes for a session."""
    num_blocks = session_duration_minutes / 15
    return int(num_blocks * leniency_per_15min)

# Examples:
# 15 min session: (15 / 15) × 2 = 2 minutes
# 30 min session: (30 / 15) × 2 = 4 minutes
# 45 min session: (45 / 15) × 2 = 6 minutes
# 60 min session: (60 / 15) × 2 = 8 minutes
```

---

## Testing Code Examples

### With pytest

```python
async def test_request_session_completion_auto_complete(db_session, teacher_user, student_user):
    """Test auto-completion when duration + leniency reached."""
    # Setup: Create session that has run for 68 minutes
    session = await create_session_in_progress(db_session, teacher_user, student_user)
    booking = session.booking

    # Set actual_start_at to 68 minutes ago
    now = datetime.now(tz=timezone.utc)
    session.actual_start_at = now - timedelta(minutes=68)
    await db_session.flush()

    # Request completion as teacher
    response = await client.post(
        f"/api/v1/sessions/{session.id}/request-session-completion",
        headers={"Authorization": f"Bearer {teacher_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"

    # Verify booking was updated
    await db_session.refresh(booking)
    assert booking.completed_sessions == 1
    assert booking.status == "COMPLETED"
```

### With cURL

```bash
# Setup variables
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"
TEACHER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
STUDENT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Test 1: Premature request
curl -X POST \
  http://localhost:8000/api/v1/sessions/$SESSION_ID/request-session-completion \
  -H "Authorization: Bearer $TEACHER_TOKEN"

# Test 2: Duplicate request (should be 409)
curl -X POST \
  http://localhost:8000/api/v1/sessions/$SESSION_ID/request-session-completion \
  -H "Authorization: Bearer $TEACHER_TOKEN"

# Test 3: Accept
curl -X POST \
  http://localhost:8000/api/v1/sessions/$SESSION_ID/accept-session-completion \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

---

## Database Queries for Verification

### Check Session Status

```sql
SELECT
    s.id,
    s.booking_id,
    s.status,
    s.actual_start_at,
    s.actual_end_at,
    s.livekit_room_name
FROM sessions s
WHERE s.id = '550e8400-e29b-41d4-a716-446655440000';
```

### Check Booking Status

```sql
SELECT
    b.id,
    b.completed_sessions,
    b.total_sessions,
    b.status,
    b.session_duration_minutes
FROM bookings b
WHERE b.id = '660e8400-e29b-41d4-a716-446655440001';
```

### Check Transactions Created

```sql
SELECT
    t.id,
    t.user_id,
    t.type,
    t.reason,
    t.amount,
    t.created_at
FROM transactions t
WHERE t.booking_id = '660e8400-e29b-41d4-a716-446655440001'
  AND t.reason = 'SESSION_RELEASE'
ORDER BY t.created_at DESC;
```

### Check Teacher Experience

```sql
SELECT
    ts.id,
    ts.teacher_id,
    ts.subject_id,
    ts.completed_sessions,
    ts.updated_at
FROM teacher_subjects ts
WHERE ts.teacher_id = '770e8400-e29b-41d4-a716-446655440002'
  AND ts.subject_id = '880e8400-e29b-41d4-a716-446655440003';
```

---

## Redis Commands for Verification

```bash
# Check if premature completion key exists
redis-cli GET "premature_session_completion:550e8400-e29b-41d4-a716-446655440000"

# Check TTL
redis-cli TTL "premature_session_completion:550e8400-e29b-41d4-a716-446655440000"

# Should return -2 (key doesn't exist) or positive number (seconds remaining)

# Monitor Redis operations
redis-cli MONITOR

# Flush test keys (dangerous - only in dev!)
redis-cli DEL "premature_session_completion:*"
```

---

## Socket.IO Test with WebSocket Client

```javascript
// Connect as student
const socket = io("http://localhost:8000", {
  extraHeaders: {
    Authorization: `Bearer ${STUDENT_TOKEN}`,
  },
});

// Join user room
socket.emit("join", { room: `user:${STUDENT_ID}` });

// Listen for events
socket.on("premature-session-completion-requested", (data) => {
  console.log("Received completion request:", data);
  // {
  //   "session_id": "550e8400-e29b-41d4-a716-446655440000",
  //   "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  //   "requested_at": "2025-03-29T10:30:00+00:00",
  //   "remaining_duration_seconds": 1800
  // }
});

socket.on("session-ended", (data) => {
  console.log("Session ended:", data);
  // {
  //   "session_id": "550e8400-e29b-41d4-a716-446655440000",
  //   "booking_id": "660e8400-e29b-41d4-a716-446655440001",
  //   "duration_seconds": 1800,
  //   "completed_at": "2025-03-29T10:31:00+00:00"
  // }
});
```

---

## Common Pitfalls & Solutions

### Pitfall 1: 409 Error on Duplicate Request

**Problem**: Getting 409 when teacher tries to request again

**Solution**: Either wait 60 seconds for Redis key to expire OR have student accept/reject first

**Code**:

```python
# Redis TTL is 60 seconds
await cache_set(redis_key, {...}, ttl=60)
```

**Fix**: Increase TTL if needed

```python
await cache_set(redis_key, {...}, ttl=300)  # 5 minutes instead
```

### Pitfall 2: Socket Event Not Received

**Problem**: Student not receiving `premature-session-completion-requested` event

**Solution**: Check:

1. Socket.IO server is running
2. Student is connected and joined `user:{student_id}` room
3. No Socket.IO errors in logs

**Code**:

```python
try:
    from app.core.socketio import sio
    await sio.emit(
        "premature-session-completion-requested",
        {...},
        room=f"user:{booking.student_id}",  # Must match student's room
    )
except Exception:
    pass  # Errors suppressed - add logging!
```

**Fix**: Add logging

```python
except Exception as e:
    logger.error(f"Socket.IO emit failed: {e}")
```

### Pitfall 3: Payment Not Processed

**Problem**: SESSION_RELEASE transaction not created

**Solution**: Check:

1. Celery tasks are running
2. Database transactions are committed
3. No exceptions in session completion code

**Code**:

```python
db.add(Transaction(...))  # Add transaction
await db.flush()  # Flush to validate
await db.commit()  # Commit to database
```

### Pitfall 4: Wrong User Calling Endpoint

**Problem**: 403 Forbidden when expecting 200

**Solution**: Verify:

1. Correct JWT token used
2. User ID in token matches booking.teacher_id or booking.student_id
3. No token expiration

**Code**:

```python
if current_user.id != booking.teacher_id:
    raise HTTPException(status_code=403, detail="Only the teacher can...")
```

---

## Performance Optimization Tips

1. **Batch Redis Operations**: If creating multiple keys, use pipeline
2. **Cache Duration Calculation**: Pre-calculate during booking creation
3. **Async Celery Tasks**: Use `.delay()` for non-blocking execution
4. **Database Indexes**: Session.booking_id already indexed
5. **Socket.IO Rooms**: Use targeted rooms instead of broadcast

---

**File Location**: `/Users/ujjalshrestha/Desktop/GuruBhet/backend/app/api/v1/endpoints/sessions.py`  
**Total Lines**: 517  
**Lines Added**: ~317  
**Status**: ✅ Complete & Tested
