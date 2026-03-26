# 🎥 Session Lifecycle & Sync Architecture

> **Resilient, Production-Ready Session Management with Automatic Reconnection**

---

## 📋 Quick Overview

This implementation provides a **complete session lifecycle** from initial handshake through reconnection, with automatic recovery on network failures.

### ⭐ What's New: Presence-Aware Session Requests

Teachers can now only request sessions if the student is online. If the student is offline, the system returns a 480 error immediately, preventing unnecessary notifications.

**Quick start**: Read [`00_START_HERE_PRESENCE_AWARE.md`](./00_START_HERE_PRESENCE_AWARE.md) for an introduction to presence-aware features.

### ✨ Key Features

| Feature                     | Benefit                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| **Presence-Aware Requests** | ⭐ NEW: Only allow sessions if student is online (480 if offline)         |
| **60-Second Handshake**     | Student must accept within window or session expires                      |
| **Redis-Backed Validation** | Fast, scalable session state tracking                                     |
| **Real-Time Notifications** | Teacher notified immediately via Socket.IO                                |
| **Direct Token Response**   | Student gets credentials on accept, no extra calls                        |
| **Auto-Reconnection**       | Handles Socket disconnect → reconnect seamlessly                          |
| **Leniency Buffer**         | Configurable grace period for late joins (e.g., 4 min for 60-min session) |
| **Sync Endpoint**           | Recovery mechanism for page refresh and reconnection                      |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TEACHER                                  │
│  POST /request-session                                       │
│  • Does NOT create session yet                               │
│  • Sets Redis: pending_session:{booking_id} (60s TTL)        │
│  • Waits for student                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                    Socket.IO
                    (notification)
                       │
                       ▼
          ┌────────────────────────┐
          │  ⏰ 60-SECOND WINDOW    │
          │     OPENS              │
          └────────────┬───────────┘
                       │
          ┌────────────▼───────────┐
          │     STUDENT            │
          │ POST /accept           │
          │ (within 60s)           │
          │ • Redis key exists? ✓  │
          │ • CREATE Session now!  │
          │ • Create room          │
          │ • PENDING → SCHEDULED  │
          │ • Get token            │
          │ • Return: {token}      │
          └────────────┬───────────┘
                       │
              ┌────────┴────────┐
              │                 │
         Teacher          Student
         GET /livekit-token     │
         or /sync          GET /livekit-token
         (with Redis key)       │ or /sync
              │                 │
              └────────┬────────┘
                       │
          SCHEDULED → IN_PROGRESS
          actual_start_at = now
          teacher_joined_at = now
          student_joined_at = now
                       │
                 ┌─────▼──────┐
                 │   LiveKit   │
                 │   Video     │
                 │   Streaming │
                 └─────┬──────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   [Teaching    Network Glitch    Session Ends
    for ~60min]  Socket:off       POST /sessions/{id}/complete
                 │                │
              Socket:on          Room torn down
              │                  Session: COMPLETED
              ▼
          GET /sync
          • Check window+leniency: now <= end+buffer?
          • Leniency = duration // 15
          • Get fresh token
          • Continue video
```

---

## 📦 What's Included

### Backend (Python + FastAPI)

**Modified Files:**

- `app/utils/livekit.py` — Redis handshake helpers
- `app/core/socketio.py` — Global Socket.IO manager
- `app/api/v1/endpoints/bookings.py` — Updated endpoints
- `app/schemas/booking.py` — New response schema

**New Endpoints:**

- `GET /bookings/{id}/sync` — Recovery & reconnection

### Frontend (TypeScript + React + Next.js)

**New Files:**

- `src/hooks/useSessionSync.ts` — Socket listener + sync logic
- `src/components/SessionVideoComponent.tsx` — LiveKit wrapper
- `src/pages/session/[bookingId]/[sessionId].tsx` — Session page

---

## 🚀 Getting Started

### ⭐ NEW: Presence-Aware Features (Start Here)

If you're implementing presence-aware session requests, start here:

```
📖 00_START_HERE_PRESENCE_AWARE.md        ← Quick introduction
📖 PRESENCE_AWARE_SESSION_REQUESTS.md     ← Complete implementation
📖 MIGRATION_PRESENCE_AWARE_MESSAGES.md   ← Database migration
📖 IMPLEMENTATION_CHECKLIST_PRESENCE_AWARE.md ← Step-by-step tasks
```

### 1. Read the Documentation (20 minutes)

Core session architecture (includes presence-aware features):

```
📖 SESSION_SYNC_SUMMARY.md           ← High-level overview ✅ UPDATED
📖 SESSION_LIFECYCLE_SYNC_ARCHITECTURE.md  ← Deep dive with diagrams ✅ UPDATED
📖 SESSION_SYNC_IMPLEMENTATION_CHECKLIST.md ← Task breakdown ✅ UPDATED
📖 SESSION_SYNC_CODE_EXAMPLES.md     ← Copy-paste examples ✅ UPDATED
```

**Quick Reference:**

```
🔍 QUICK_REFERENCE.md                ← For quick lookup ✅ UPDATED
🔍 DOCUMENTATION_CROSS_REFERENCES.md ← All links & relationships (NEW)
```

### 2. Implement Backend (3.5 hours)

Follow the **Implementation Checklist** Phase 1:

```bash
# 0. Presence Detection (45 min) ⭐ NEW
#    - app/utils/presence.py
#    - is_user_online() function
#    - create_session_request_message() function
#
# 1. Add Redis helpers (30 min)
# 2. Add SocketIO manager (30 min)
# 3. Update endpoints (120 min) ⭐ UPDATED
#    - /request-session (with presence check) ⭐ NEW
#    - /accept (moved Session creation here, + message creation)
#    - /sync (NEW)
# 4. Update schemas (30 min)
# 5. Test (60 min)
```

### 3. Implement Frontend (2 hours)

Follow the **Implementation Checklist** Phase 2-3:

```bash
# 1. Create useSessionSync hook (45 min)
# 2. Create SessionVideoComponent (45 min)
# 3. Create session page (30 min)
```

### 4. Test Everything (2 hours)

```bash
# Backend tests
pytest tests/

# Frontend tests
npm test
npm run test:e2e

# Manual testing
# See testing scenarios in documentation
```

### 5. Deploy (1 hour)

```bash
# Staging
# Production (blue-green)
# Monitor
```

---

## 💡 Key Concepts

### Redis Handshake (60 seconds)

```
Teacher initiates
    ↓
Set: pending_session:{booking_id} = {session_id}
     TTL: 60 seconds (auto-expires)
    ↓
Wait for student to accept within 60 seconds
    ↓
If student accepts:
  ✅ Create room, return token, clear Redis key

If 60 seconds pass:
  ❌ Redis key expires, student gets 410 Gone
```

### Leniency Buffer

```
Formula: leniency_minutes = session_duration_minutes // 15

Examples:
  15 min session → 1 min grace  (16 min total)
  30 min session → 2 min grace  (32 min total)
  60 min session → 4 min grace  (64 min total)

Prevents unfair session termination for network glitches
```

### Auto-Reconnection Flow

```
User in session
    ↓
Network glitch (WiFi drops, etc.)
    ↓
Socket.IO disconnect event
    ↓
(wait for network recovery)
    ↓
Socket.IO connect event fires
    ↓
useSessionSync hook detects reconnect
    ↓
Auto-calls GET /sync
    ↓
Get fresh token
    ↓
LiveKit component re-initializes
    ↓
Video resumes
    ↓
User never left the session (UI shows "Reconnecting..." briefly)
```

---

## 🔍 Error Scenarios

### Scenario 1: Student Too Slow to Accept

```
Time: T
Teacher: POST /start-session
  └─ Redis: pending_session:{booking_id} (expires at T+60)

Time: T+65
Student: POST /accept
  └─ Redis key expired ❌
  └─ Response: 410 Gone
  └─ UI: Show "Window expired, ask teacher to try again"
```

### Scenario 2: Network Disconnect During Session

```
Time: T+45 (mid-session)
User: Lose WiFi connection
  └─ Socket.IO: disconnect event
  └─ LiveKit: stops streaming

Time: T+48 (WiFi recovered)
Socket.IO: connect event
  └─ useSessionSync detects reconnect
  └─ Calls GET /sync
  └─ Check: now (T+48) <= allowed_end (T+64)? ✅ YES
  └─ Return fresh token
  └─ LiveKit: reconnect with new token
  └─ Video resumes
```

### Scenario 3: Join After Leniency Expires

```
Session: 60 minutes (started at T+0, ends at T+60)
Leniency: 4 minutes
Allowed until: T+64

Time: T+65
User: Tries to sync (network just recovered)
  └─ Check: now (T+65) <= allowed_end (T+64)? ❌ NO
  └─ Response: 403 Forbidden
  └─ UI: Show "Session expired" and redirect to dashboard
```

---

## 📊 Response Models

### POST `/accept` Response

```json
{
  "id": "uuid",
  "booking_id": "uuid",
  "session_number": 1,
  "status": "SCHEDULED",
  "livekit_room_name": "session-{id}",
  "teacher_initiated_at": "2026-03-26T10:45:00Z",
  "student_accepted_at": "2026-03-26T10:45:30Z",
  "actual_start_at": null,
  "actual_end_at": null,
  "token": "eyJhbGc...", // ✨ NEW
  "livekit_url": "https://..." // ✨ NEW
}
```

### GET `/sync` Response

```json
{
  "token": "eyJhbGc...",
  "room_name": "session-{id}",
  "livekit_url": "https://..."
}
```

---

## 🧪 Testing Examples

### Backend Unit Test

```python
@pytest.mark.asyncio
async def test_accept_within_window():
    """Student accepts within 60 seconds → success"""
    booking_id = "..."
    session_id = "..."

    # Teacher initiates
    await set_pending_session_key(booking_id, session_id, ttl=60)

    # Student accepts immediately
    response = await client.post(f"/bookings/{booking_id}/sessions/{session_id}/accept")

    assert response.status_code == 200
    assert "token" in response.json()
    assert "room_name" in response.json()
```

### Frontend Test

```typescript
test('Auto-reconnect on Socket.IO connect', async () => {
  // Setup: Session in progress
  render(<SessionVideoComponent {...props} />);

  // Simulate network disconnect
  socket.disconnect();

  // Verify: "Reconnecting..." shown
  expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();

  // Simulate network recovered
  socket.connect();

  // Verify: /sync called
  await waitFor(() => {
    expect(fetchMock.lastCall()[0]).toContain('/sync');
  });

  // Verify: Token updated
  expect(screen.getByText(/connected/i)).toBeInTheDocument();
});
```

---

## 📈 Performance

| Operation             | Time   | Notes         |
| --------------------- | ------ | ------------- |
| Redis key check       | <50ms  | No DB         |
| Token generation      | <100ms | Crypto        |
| LiveKit room create   | <2s    | API call      |
| Socket event delivery | <100ms | LAN           |
| /sync endpoint        | <500ms | DB + crypto   |
| Page reconnect        | <3s    | Socket + room |

---

## 🔐 Security Considerations

✅ **JWT Token**

- Signed with LiveKit secret
- Includes user identity and permissions
- Expires per LiveKit config

✅ **Redis Keys**

- Scoped to booking: `pending_session:{booking_id}`
- Verified against session_id
- Auto-expires after TTL

✅ **Authorization**

- User must be teacher or student in booking
- Verified on every endpoint
- Socket.IO joins user to their room

✅ **CORS**

- Socket.IO CORS configured
- Frontend origin whitelisted
- Credentials in cookies/Authorization header

---

## 🚨 Troubleshooting

### Issue: Student gets 410 even within 60 seconds

**Causes:**

1. Network latency > 60s
2. Server clock skewed
3. Redis key not set properly

**Solutions:**

- Increase window to 90s: `await set_pending_session_key(..., ttl=90)`
- Sync server time: `sudo ntpdate -s pool.ntp.org`
- Check Redis: `redis-cli get pending_session:*`

### Issue: /sync returns 403 too aggressively

**Causes:**

1. Leniency buffer too small
2. Session duration misconfigured

**Solutions:**

- Increase leniency formula: `duration // 10` instead of `duration // 15`
- Verify session duration: `booking.session_duration_minutes`

### Issue: Socket.IO not firing reconnect event

**Causes:**

1. Socket not properly initialized
2. Socket instance different from hook instance

**Solutions:**

- Check `useSocket()` context is wrapping component
- Verify socket initialized before page renders
- Add debug logging: `socket.on('connect', () => console.log(...))`

---

## 📚 Documentation Structure

```
📂 docs/03-video-sessions/
├── 📄 SESSION_SYNC_SUMMARY.md (this file)
│   └─ High-level overview, getting started
├── 📄 SESSION_LIFECYCLE_SYNC_ARCHITECTURE.md
│   └─ Complete technical guide with diagrams
├── 📄 SESSION_SYNC_IMPLEMENTATION_CHECKLIST.md
│   └─ Step-by-step implementation tasks
├── 📄 SESSION_SYNC_CODE_EXAMPLES.md
│   └─ Copy-paste code snippets and tests
└── 📄 LIVEKIT_INTEGRATION.md
    └─ General LiveKit information
```

---

## ✅ Checklist Before Launch

- [ ] All backend tests passing
- [ ] All frontend tests passing
- [ ] E2E tests passing
- [ ] Code reviewed and approved
- [ ] Documentation reviewed
- [ ] Staging deployment successful
- [ ] Smoke tests passed
- [ ] No regressions in existing features
- [ ] Performance metrics acceptable
- [ ] Monitoring/alerting configured
- [ ] Runbook/troubleshooting guide ready
- [ ] Team trained on new features

---

## 📞 Support

**For Implementation Questions:**

- See `SESSION_SYNC_CODE_EXAMPLES.md`

**For Architecture Questions:**

- See `SESSION_LIFECYCLE_SYNC_ARCHITECTURE.md`

**For Debugging:**

- See Troubleshooting section above
- Check logs: `docker logs app`
- Check Redis: `redis-cli monitor`

---

## 🎓 Learning Resources

**Topics Covered:**

- Redis key expiry and TTL
- Socket.IO real-time events
- HTTP 410 Gone status code
- JWT token generation
- Async/await in Python
- React hooks and state management
- Next.js dynamic routes
- FastAPI dependency injection
- SQLAlchemy ORM queries

**New Patterns Demonstrated:**

- Redis-backed handshake
- Leniency buffer calculation
- Auto-reconnection on Socket events
- Token refresh without UI flicker
- Graceful error handling and redirects

---

## 📝 Version

**Version:** 1.0  
**Release Date:** March 26, 2026  
**Status:** Ready for Implementation  
**Maintenance:** Maintained by GuruBhet Backend Team

---

## 📄 License

Part of the GuruBhet project.

---

**Start implementing:** Read `SESSION_LIFECYCLE_SYNC_ARCHITECTURE.md` next! 🚀
