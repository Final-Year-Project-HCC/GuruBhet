# Resilient Session Lifecycle & Sync Architecture

**Date:** March 26, 2026  
**Status:** ✅ Implemented  
**Type:** Session handshake, recovery, and reconnection system

---

## Overview

This implementation provides a **robust, resilient session lifecycle** that handles:

1. **Presence-aware session requests** — Teacher can only request session if student is online (480 if offline)
2. **60-second handshake window** — Teacher initiates, student accepts within 60 seconds
3. **Redis-backed state** — Fast validation without DB queries
4. **Socket.IO notifications** — Real-time session_ready event to teacher
5. **Automatic reconnection** — Frontend syncs on Socket reconnect/page refresh
6. **Leniency buffer** — Grace period for late joins (1 min per 15 min of session)

---

## Architecture Diagram

```
BACKEND (FastAPI + Redis + PostgreSQL)
────────────────────────────────────────────────────────────────────

Teacher                          Student                    System
──────────────────────────────────────────────────────────────────

POST /request-session ⭐ NEW: PRESENCE CHECK
    │
    ├─► Is student online? (Redis + Socket.IO presence check)
    │   │
    │   ├─► ✅ YES: Continue
    │   │
    │   └─► ❌ NO: Return 480 "Student is currently offline"
    │
    └─► Set Redis: pending_session:{booking_id} (60s TTL)
        Create Message: SESSION_REQUEST
        Socket.IO: emit to student
        Response: {"status": "ready", ...}

                            ⏰ 60-SECOND WINDOW OPENS

                        POST /accept
                        (within 60s)
                            │
                            ├─► Check Redis: pending_session exists? (yes)
                            │
                            ├─► Create LiveKit room
                            │   Cache room state in Redis
                            │
                            ├─► Clear Redis key
                            │
                            ├─► Session: SCHEDULED ✅
                            │
                            ├─► Create Message: NOTIFICATION_ACCEPTED
                            │
                            ├─► Socket.IO: emit to teacher
                            │       event: "session_ready"
                            │       data: {token, room, url}
                            │
                            └─► Response to student:
                                {token, room, livekit_url}

GET /livekit-token  (or /sync on reconnect)
    │
    ├─► Verify session SCHEDULED/IN_PROGRESS
    ├─► Record join timestamp
    ├─► SCHEDULED → IN_PROGRESS (first join)
    ├─► actual_start_at = now
    │
    └─► Generate fresh token

[Teaching happens ~60 minutes]

POST /sessions/{id}/complete
    │
    ├─► LiveKit room torn down
    ├─► Session: COMPLETED
    │
    └─► Cleanup


FRONTEND (Next.js + React + LiveKit SDK)
────────────────────────────────────────────────────────────────────

Student UI                      System
──────────────────────────────────────────────────────────────────

<Session Page Loads>
    │
    ├─► useSessionSync hook activates
    │   (registers Socket.IO listeners)
    │
    └─► POST /accept
            │
            ├─► Get {token, room, url}
            │
            └─► Render <SessionVideoComponent>
                    │
                    ├─► <LiveKitRoom token={token} />
                    │
                    └─► Show "🔄 Reconnect" button

[Browser loses connection]
    │
    ├─► Socket.IO disconnect
    │
    └─► (wait for reconnection...)

[Network recovered]
    │
    ├─► Socket.IO 'connect' event
    │
    ├─► useSessionSync detects reconnect
    │
    ├─► Auto-calls GET /sync
    │       │
    │       ├─► Validate: within window + leniency?
    │       │
    │       ├─► Get fresh token
    │       │
    │       └─► Update <LiveKitRoom>
    │
    └─► Continue session

[Page refresh]
    │
    ├─► <SessionPage> remounts
    │
    ├─► Call POST /accept or GET /livekit-token
    │   (session already SCHEDULED)
    │
    ├─► Get {token, room, url}
    │
    └─► Reconnect to room

[Session expires]
    │
    ├─► Redirect to dashboard
    │
    └─► Show "Session Expired" toast
```

---

## Backend Implementation

### 1. Redis Handshake Keys

**Function:** `app/utils/livekit.py`

```python
async def set_pending_session_key(booking_id: str, session_id: str, ttl: int = 60) -> None:
    """
    Set: pending_session:{booking_id} = {session_id}
    TTL: 60 seconds (auto-expires)
    """

async def get_pending_session_key(booking_id: str) -> dict | None:
    """
    Get: {session_id} if exists, None if expired
    """

async def clear_pending_session_key(booking_id: str) -> None:
    """
    Delete key after successful acceptance
    """

async def set_session_room_state(session_id: str, ...) -> None:
    """
    Cache: session_room_state:{session_id} = {room_name, teacher_joined, student_joined}
    TTL: 1 hour (for sync operations)
    """
```

### 2. Endpoint: POST `/start-session`

**File:** `app/api/v1/endpoints/bookings.py`

```python
@router.post("/{booking_id}/start-session", response_model=BookingRead)
async def initiate_session_request(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    # NEW: Set Redis key for 60-second window
    await set_pending_session_key(str(booking_id), str(session.id), ttl=60)

    return booking
```

**Behavior:**

- ✅ Only teacher can call
- ✅ Booking must be ACTIVE
- ✅ **NOTE:** Session is NOT created here (created when student accepts)
- ✅ **NEW:** Sets Redis key (60-second TTL)
- ✅ **NEW:** Socket.IO notification to student

---

### 3. Endpoint: POST `/accept-session`

**File:** `app/api/v1/endpoints/bookings.py`

**Response Model:** `LiveKitTokenResponse`

```python
@router.post("/{booking_id}/accept-session", response_model=LiveKitTokenResponse)
async def accept_session_request(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    # Check Redis key (60-second window validation)
    pending = await get_pending_session_key(str(booking_id))
    if not pending:
        raise HTTPException(410, "Session acceptance window expired")

    # CREATE Session NOW (on acceptance)
    session = Session(
        booking_id=booking_id,
        session_number=...,
        status=SessionStatus.READY,
        student_accepted_at=datetime.now(tz=timezone.utc),
    )
    db.add(session)
    await db.flush()

    # Create LiveKit room immediately
    room_name = await create_room(str(session.id), booking.session_duration_minutes)
    session.livekit_room_name = room_name
    await db.flush()

    # Clear Redis key
    await clear_pending_session_key(str(booking_id))

    # Emit Socket.IO event to teacher with their token
    teacher_token = generate_room_token(...)
    await sio_manager.emit_to_user(
        user_id=booking.teacher_id,
        event="session_ready",
        data={"token": teacher_token, "room_name": room_name, ...}
    )

    # Webhook will transition: READY → IN_PROGRESS when room created
    # Return student's token in response
    return LiveKitTokenResponse(
        token=generate_room_token(...),
        room_name=room_name,
        livekit_url=settings.LIVEKIT_URL
    )
```

**Preconditions:**

- ✅ Current user: STUDENT
- ✅ **NEW:** Redis key exists (window not expired, within 60 seconds)
- ✅ Student belongs to this booking

**Returns:**

- ✅ Session data + **LiveKit token + room_name + livekit_url**

**Errors:**

- `410 Gone` — Redis key expired (>60 seconds)
- `400 Bad Request` — Wrong session status or other validation fails

---

### 4. Endpoint: GET `/sync`

**File:** `app/api/v1/endpoints/bookings.py`

**Response Model:** `LiveKitTokenResponse`

```python
@router.get("/{booking_id}/sync", response_model=LiveKitTokenResponse)
async def sync_session(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    """
    Called by frontend on Socket.IO reconnect or page refresh.
    Validates session is still within allowed window + leniency.
    Returns fresh LiveKit token.
    """

    # Find the IN_PROGRESS session
    # NOTE: Webhook guarantees session is IN_PROGRESS (transitioned from READY)
    session = await db.get(Session).filter(
        Session.status == SessionStatus.IN_PROGRESS
    ).first()

    # ── LENIENCY BUFFER CALCULATION ──
    session_duration_minutes = booking.session_duration_minutes
    leniency_multiplier = settings.LIVEKIT_ROOM_LENIENCY_MINUTES_PER_15MIN
    leniency_minutes = (session_duration_minutes // 15) * leniency_multiplier

    allowed_end_time = session.actual_start_at + timedelta(minutes=session_duration_minutes + leniency_minutes)

    if now > allowed_end_time:
        raise HTTPException(403, "Session window expired")

    # Record join timestamp
    session.teacher_joined_at = now  # or student_joined_at
    await db.flush()
        session.actual_start_at = now

    # Generate fresh token
    token = generate_room_token(...)

    return {token, room_name, livekit_url}
```

**Leniency Formula:**

```
leniency_minutes = session_duration_minutes // 15

Examples:
- 15-min session → 1-min leniency → 16 min total window
- 30-min session → 2-min leniency → 32 min total window
- 45-min session → 3-min leniency → 48 min total window
- 60-min session → 4-min leniency → 64 min total window
```

**Preconditions:**

- ✅ Current user: teacher or student in booking
- ✅ Booking: ACTIVE
- ✅ Session exists and is IN_PROGRESS or SCHEDULED

**Returns:**

- ✅ `200 OK` — Fresh token + room info

**Errors:**

- `403 Forbidden` — Session window + leniency expired
- `410 Gone` — Session not found or booking not active
- `500 Internal Server Error` — Room not initialized

---

## Frontend Implementation

### 1. Hook: `useSessionSync`

**File:** `src/hooks/useSessionSync.ts`

```typescript
export function useSessionSync(options: SyncOptions = {}) {
  const { onSuccess, onExpired, onError, autoReconnect = true } = options;

  const sync = useCallback(async () => {
    const response = await fetch(`/api/v1/bookings/${bookingId}/sync`);

    if (response.status === 403) {
      // Session expired
      onExpired?.();
      router.push('/dashboard?reason=session_expired');
    }

    if (response.status === 410) {
      // Session gone
      onExpired?.();
      router.push('/dashboard?reason=session_gone');
    }

    const data = await response.json();
    initializeLiveKit({token: data.token, ...});
    onSuccess?.(data);
  }, [...]);

  // Auto-sync on Socket reconnect
  useEffect(() => {
    socket.on('connect', () => sync());
    return () => socket.off('connect', ...);
  }, [socket, sync]);

  return { sync };
}
```

**Usage:**

```typescript
const { sync } = useSessionSync({
  onSuccess: (data) => {
    /* Update token */
  },
  onExpired: () => {
    /* Redirect */
  },
  autoReconnect: true,
});

// Manual sync: await sync();
```

---

### 2. Component: `SessionVideoComponent`

**File:** `src/components/SessionVideoComponent.tsx`

```typescript
export function SessionVideoComponent({
  bookingId, sessionId, initialToken, initialRoomName, liveKitUrl
}: SessionVideoComponentProps) {
  const [token, setToken] = useState(initialToken);
  const [roomName, setRoomName] = useState(initialRoomName);

  const { sync } = useSessionSync({
    onSuccess: (data) => {
      // Token refreshed, re-initialize room
      setToken(data.token);
      setRoomName(data.room_name);
    },
    autoReconnect: true,
  });

  return (
    <div>
      <button onClick={sync}>🔄 Reconnect</button>
      <LiveKitRoom token={token} roomName={roomName} />
    </div>
  );
}
```

---

### 3. Page: Session Page

**File:** `src/pages/session/[bookingId]/[sessionId].tsx`

```typescript
export default function SessionPage() {
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    // POST /accept to get initial token
    fetch(`/api/v1/bookings/${bookingId}/sessions/${sessionId}/accept`, {
      method: 'POST'
    }).then(r => r.json()).then(data => {
      setSessionData(data);  // {token, room_name, livekit_url}
    });
  }, []);

  if (!sessionData) return <Loading />;

  return (
    <SessionVideoComponent
      bookingId={bookingId}
      sessionId={sessionId}
      initialToken={sessionData.token}
      initialRoomName={sessionData.room_name}
      liveKitUrl={sessionData.livekit_url}
    />
  );
}
```

---

## Error Handling

| Scenario                          | HTTP            | Response                           | Frontend Action                   |
| --------------------------------- | --------------- | ---------------------------------- | --------------------------------- |
| Accept window expired (>60s)      | 410 Gone        | `{detail: "Window expired"}`       | Redirect to dashboard, show error |
| Session already in progress       | 400 Bad Request | `{detail: "Already accepted"}`     | Get token from `/livekit-token`   |
| Sync called after window+leniency | 403 Forbidden   | `{detail: "Window expired"}`       | Redirect to dashboard             |
| Session not found                 | 410 Gone        | `{detail: "No active session"}`    | Redirect to dashboard             |
| Network error during sync         | N/A             | Exception                          | Show "Reconnecting..." and retry  |
| LiveKit room not initialized      | 500 Internal    | `{detail: "Room not initialized"}` | Show error and retry              |

---

## Sequence Examples

### Example 1: Happy Path (Student Accepts Quickly)

```timeline
10:45:00 UTC
├─ Teacher: POST /start-session
├─ Response: Booking (status ACTIVE)
├─ Redis: set pending_session:booking-1 (ttl=60s)
└─ Socket: notify teacher "Session initiated"

10:45:30 UTC
├─ Student: POST /accept
├─ Check Redis: pending_session:booking-1 exists ✅
├─ Create LiveKit room
├─ Session: PENDING → SCHEDULED
├─ Clear Redis key
├─ Socket: emit "session_ready" to teacher + token
└─ Response: {token, room, url}

10:45:31 UTC
├─ Student: Render <SessionVideoComponent>
├─ LiveKit: connect with token
└─ Video stream begins

10:45:32 UTC
├─ GET /sync or /livekit-token
├─ Session: SCHEDULED → IN_PROGRESS
├─ actual_start_at = 10:45:32
├─ student_joined_at = 10:45:32
└─ Return fresh token

[Teaching happens for 60 minutes]

11:46:00 UTC
├─ Teacher: POST /sessions/{id}/complete
├─ Session: COMPLETED
├─ LiveKit room torn down
└─ Booking updated (completed_sessions++)
```

---

### Example 2: Accept Window Expires

```timeline
10:45:00 UTC
└─ Teacher: POST /start-session
   Redis: set pending_session:booking-1 (ttl=60s)

10:46:05 UTC
├─ Student: POST /accept
├─ Check Redis: pending_session:booking-1 ❌ EXPIRED!
└─ Response: 410 Gone

Student UI:
├─ Catch 410 error
├─ Show toast: "Window expired, ask teacher to start again"
└─ Redirect to /dashboard
```

---

### Example 3: Network Disconnection + Reconnect

```timeline
10:45:35 UTC
├─ Student connected to LiveKit
├─ Streaming video
└─ Socket.IO: connected

10:46:00 UTC
├─ Network glitch
├─ Socket.IO: disconnect event
├─ LiveKit: stops streaming
└─ Browser: shows reconnect button

10:46:05 UTC
├─ Network recovered
├─ Socket.IO: 'connect' event fires
├─ useSessionSync detects reconnect
├─ Auto-calls GET /sync
│  ├─ Check: now (10:46:05) <= allowed_end_time ✅
│  ├─ Generate fresh token
│  └─ Return {token, room, url}
├─ SessionVideoComponent: update token
├─ LiveKit: reconnect with new token
└─ Video stream resumes

[Continue teaching]
```

---

### Example 4: Late Join (Within Leniency)

```timeline
SETUP: 60-minute booking (session_duration_minutes=60)
leniency = 60 // 15 = 4 minutes

10:45:35 UTC
├─ actual_start_at = 10:45:35
├─ allowed_end_time = 10:45:35 + 60min + 4min = 10:49:35

10:47:00 UTC (61 minutes after start)
├─ Student (was offline): GET /sync
├─ Check: 10:47:00 <= 10:49:35? ✅ YES
├─ Generate token
└─ Student joins late, continues learning

10:49:40 UTC (64 minutes 5 seconds after start)
├─ Student: GET /sync
├─ Check: 10:49:40 <= 10:49:35? ❌ NO
├─ Response: 403 Forbidden
└─ Redirect to dashboard
```

---

## Configuration

### Backend Environment Variables

```bash
# In .env
REDIS_URL=redis://localhost:6379  # Already set

# LiveKit (already configured)
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=...
```

### Frontend Environment Variables

```bash
# In .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000  # FastAPI backend
NEXT_PUBLIC_LIVEKIT_URL=...  # LiveKit server (optional, from response)
```

---

## Testing Checklist

### Backend

- [ ] `POST /start-session` creates Redis key with 60s TTL
- [ ] `POST /accept` within 60s succeeds, returns token
- [ ] `POST /accept` after 60s returns 410 Gone
- [ ] `POST /accept` clears Redis key
- [ ] `POST /accept` creates LiveKit room
- [ ] Socket.IO event `session_ready` sent to teacher
- [ ] `GET /sync` returns fresh token
- [ ] `GET /sync` validates leniency window correctly
- [ ] `GET /sync` records join timestamps
- [ ] `GET /sync` after window+leniency expires returns 403
- [ ] `GET /livekit-token` transitions SCHEDULED → IN_PROGRESS

### Frontend

- [ ] `useSessionSync` hook registers Socket.IO listener
- [ ] Auto-sync on `socket.on('connect')`
- [ ] Manual sync via `sync()` function works
- [ ] `SessionVideoComponent` renders with initial token
- [ ] Token update triggers LiveKit re-initialization
- [ ] 410/403 errors redirect to dashboard
- [ ] "Reconnect" button manually calls sync
- [ ] Toast notifications show for all state changes

### Integration

- [ ] E2E: Teacher starts → Student accepts → Video streams
- [ ] E2E: Page refresh → Session recovers
- [ ] E2E: Network disconnect → Auto-reconnect works
- [ ] E2E: After window+leniency → Redirect on next sync

---

## Deployment Checklist

- [ ] Redis server running and accessible
- [ ] Backend environment variables set
- [ ] Frontend environment variables set
- [ ] LiveKit URL accessible from browser
- [ ] CORS configured for Socket.IO
- [ ] Session affinity (sticky sessions) configured for load balancer
- [ ] Database migrations applied
- [ ] Tests passing

---

## Future Enhancements

1. **Heartbeat mechanism** — Client sends "I'm still here" every 5s
2. **Grace period for teacher** — Teacher gets token before student accepts
3. **Recording sync** — Sync endpoint also returns recording status
4. **Analytics** — Track no-shows, late joins, reconnects per session
5. **Notifications** — Email if student doesn't accept within 30s
6. **Session rescheduling** — If acceptance window expires, reschedule option

---

## Summary

This implementation provides:

✅ **Resilience** — Automatic reconnection, leniency buffer  
✅ **Low Latency** — Redis for fast handshake validation  
✅ **Real-time** — Socket.IO notifications to teacher  
✅ **Recovery** — Frontend syncs on reconnect/refresh  
✅ **Clear UX** — Proper error messages and redirects  
✅ **Scalability** — Stateless design, no sticky sessions needed (except for Socket)

**Total Implementation Time:** ~6-8 hours (backend: 3h, frontend: 2h, testing: 2h)
