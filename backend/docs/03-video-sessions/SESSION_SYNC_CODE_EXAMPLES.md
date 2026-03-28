# Session Sync - Code Examples & Reference

Quick copy-paste examples for implementation.

---

## Backend Examples

### 0. Presence Check - Testing Online Status ⭐ NEW

```python
# tests/unit/test_presence_check.py
import pytest
from app.utils.presence import is_user_online
from uuid import uuid4


@pytest.mark.asyncio
async def test_user_online_in_redis():
    """Verify user is detected as online."""
    user_id = str(uuid4())

    # Mark user as online in Redis
    redis = get_redis()
    await redis.sadd("online_users", user_id)

    # Check presence
    online = await is_user_online(user_id)
    assert online is True

    # Cleanup
    await redis.srem("online_users", user_id)


@pytest.mark.asyncio
async def test_user_offline_not_in_redis():
    """Verify user is detected as offline."""
    user_id = str(uuid4())

    # User not in Redis
    online = await is_user_online(user_id)
    assert online is False


@pytest.mark.asyncio
async def test_request_session_student_offline():
    """Teacher requests session but student is offline."""
    # Ensure student is offline
    student_id = test_student.id
    redis = get_redis()
    await redis.srem("online_users", student_id)

    # Teacher requests session
    response = await async_client.post(
        f"/api/v1/bookings/{booking_id}/request-session",
        headers={"Authorization": f"Bearer {test_teacher.token}"},
    )

    # Should return 480
    assert response.status_code == 480
    data = response.json()
    assert "offline" in data["detail"].lower()

    # Message should be created with type NOTIFICATION_ERROR
    message = db.query(Message).filter_by(
        booking_id=booking_id,
        type=MessageType.NOTIFICATION_ERROR
    ).first()
    assert message is not None
```

---

### 1. Testing the Redis Handshake

```python
# tests/unit/test_redis_handshake.py
import pytest
from datetime import datetime, timezone, timedelta
from app.utils.livekit import (
    set_pending_session_key,
    get_pending_session_key,
    clear_pending_session_key,
)
from app.db.redis import cache_get, cache_set
from uuid import uuid4


@pytest.mark.asyncio
async def test_set_and_get_pending_session():
    """Verify Redis handshake key operations."""
    booking_id = str(uuid4())
    session_id = str(uuid4())

    # Set key
    await set_pending_session_key(booking_id, session_id, ttl=60)

    # Verify it exists
    pending = await get_pending_session_key(booking_id)
    assert pending is not None
    assert pending["session_id"] == session_id

    # Clear it
    await clear_pending_session_key(booking_id)

    # Verify it's gone
    pending = await get_pending_session_key(booking_id)
    assert pending is None


@pytest.mark.asyncio
async def test_pending_session_key_expires():
    """Verify Redis key expires after TTL."""
    booking_id = str(uuid4())
    session_id = str(uuid4())

    # Set with 1-second TTL
    await set_pending_session_key(booking_id, session_id, ttl=1)

    # Should exist immediately
    pending = await get_pending_session_key(booking_id)
    assert pending is not None

    # Wait for expiry
    import asyncio
    await asyncio.sleep(1.5)

    # Should be gone
    pending = await get_pending_session_key(booking_id)
    assert pending is None
```

---

### 2. Test POST /accept with Redis Validation

```python
# tests/integration/test_accept_session.py
import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from app.core.enums import SessionStatus
from app.utils.livekit import set_pending_session_key, get_pending_session_key


@pytest.mark.asyncio
async def test_accept_session_within_window(
    async_client, test_student, test_teacher, test_booking, test_session, db
):
    """Student accepts within 60-second window."""
    booking_id = test_booking.id
    session_id = test_session.id

    # Set Redis key (simulating teacher's /start-session)
    await set_pending_session_key(str(booking_id), str(session_id), ttl=60)

    # Student accepts
    response = await async_client.post(
        f"/api/v1/bookings/{booking_id}/sessions/{session_id}/accept",
        headers={"Authorization": f"Bearer {test_student.token}"},
    )

    # Should succeed with 200
    assert response.status_code == 200
    data = response.json()

    # Response should include token
    assert "token" in data
    assert "room_name" in data
    assert "livekit_url" in data

    # Session should be READY (webhook will later transition to IN_PROGRESS)
    await db.refresh(test_session)
    assert test_session.status == SessionStatus.READY

    # Redis key should be cleared
    pending = await get_pending_session_key(str(booking_id))
    assert pending is None

    # Message should be created with type NOTIFICATION_ACCEPTED ⭐ NEW
    message = db.query(Message).filter_by(
        booking_id=booking_id,
        type=MessageType.NOTIFICATION_ACCEPTED
    ).first()
    assert message is not None


@pytest.mark.asyncio
async def test_accept_session_after_window_expires(
    async_client, test_student, test_booking, test_session, db
):
    """Student accepts after window expires (>60s)."""
    booking_id = test_booking.id
    session_id = test_session.id

    # Set Redis key with 0.1 second TTL
    await set_pending_session_key(str(booking_id), str(session_id), ttl=0)

    # Wait for expiry
    import asyncio
    await asyncio.sleep(0.5)

    # Student tries to accept
    response = await async_client.post(
        f"/api/v1/bookings/{booking_id}/sessions/{session_id}/accept",
        headers={"Authorization": f"Bearer {test_student.token}"},
    )

    # Should fail with 410 Gone
    assert response.status_code == 410
    assert "expired" in response.json()["detail"].lower()
```

---

### 3. Test GET /sync with Leniency

```python
# tests/integration/test_sync_endpoint.py
@pytest.mark.asyncio
async def test_sync_within_leniency_buffer(
    async_client, test_student, test_booking, test_session, db
):
    """
    Session: 60 minutes → leniency = 4 minutes
    allowed_end = actual_start + 64 minutes
    """
    # Setup: Session in progress
    test_session.status = SessionStatus.IN_PROGRESS
    test_session.actual_start_at = datetime.now(tz=timezone.utc) - timedelta(minutes=62)
    await db.flush()

    # Current time: 62 minutes after start (within 64-min window)
    # Should succeed
    response = await async_client.get(
        f"/api/v1/bookings/{test_booking.id}/sync",
        headers={"Authorization": f"Bearer {test_student.token}"},
    )

    assert response.status_code == 200
    assert "token" in response.json()


@pytest.mark.asyncio
async def test_sync_after_leniency_expired(
    async_client, test_student, test_booking, test_session, db
):
    """
    Session started 65+ minutes ago
    allowed_end = start + 64 minutes
    now > allowed_end → 403
    """
    # Setup: Session started 65 minutes ago
    test_session.status = SessionStatus.IN_PROGRESS
    test_session.actual_start_at = datetime.now(tz=timezone.utc) - timedelta(minutes=65)
    await db.flush()

    # Should fail
    response = await async_client.get(
        f"/api/v1/bookings/{test_booking.id}/sync",
        headers={"Authorization": f"Bearer {test_student.token}"},
    )

    assert response.status_code == 403
    assert "expired" in response.json()["detail"].lower()
```

---

### 4. Leniency Calculation Examples

```python
# Examples of leniency buffer calculation

def calculate_leniency(session_duration_minutes: int) -> int:
    """Formula: 1 minute per 15 minutes of duration."""
    return session_duration_minutes // 15


# Examples:
assert calculate_leniency(15) == 1    # 15 min session → 1 min leniency
assert calculate_leniency(30) == 2    # 30 min session → 2 min leniency
assert calculate_leniency(45) == 3    # 45 min session → 3 min leniency
assert calculate_leniency(60) == 4    # 60 min session → 4 min leniency
assert calculate_leniency(90) == 6    # 90 min session → 6 min leniency
assert calculate_leniency(120) == 8   # 120 min session → 8 min leniency

# Window calculation:
session_start = datetime(2026, 3, 26, 10, 45, 35, tzinfo=timezone.utc)
duration_minutes = 60
leniency_minutes = 4
allowed_end_time = session_start + timedelta(minutes=duration_minutes + leniency_minutes)
# allowed_end_time = 2026-03-26 11:49:35 UTC
```

---

## Frontend Examples

### 1. useSessionSync Hook Usage

```typescript
// Example: Using the hook in a component

import { useSessionSync } from '@/hooks/useSessionSync';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/router';
import { useState } from 'react';

export function MySessionComponent() {
  const { showToast } = useToast();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { sync } = useSessionSync({
    onSuccess: (data) => {
      console.log('Sync successful:', data);
      setToken(data.token);
      setError(null);
    },
    onExpired: () => {
      console.log('Session expired');
      setError('Session has expired');
      router.push('/dashboard?reason=expired');
    },
    onError: (error) => {
      console.error('Sync error:', error);
      setError(`Error: ${error.message}`);
    },
    autoReconnect: true,
  });

  // Manual sync button
  const handleReconnect = async () => {
    showToast('Reconnecting...', 'info');
    await sync();
  };

  if (error) {
    return (
      <div className="error-box">
        <p>{error}</p>
        <button onClick={() => router.push('/dashboard')}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (!token) {
    return <div>Loading token...</div>;
  }

  return (
    <div>
      <button onClick={handleReconnect}>🔄 Reconnect</button>
      <div>Token: {token.substring(0, 20)}...</div>
    </div>
  );
}
```

---

### 2. Session Page Implementation

```typescript
// pages/session/[bookingId]/[sessionId].tsx - Full example

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { SessionVideoComponent } from '@/components/SessionVideoComponent';

interface TokenData {
  token: string;
  room_name: string;
  livekit_url: string;
}

export default function SessionPage() {
  const router = useRouter();
  const { bookingId, sessionId } = router.query as {
    bookingId?: string;
    sessionId?: string;
  };

  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !sessionId) return;

    const initializeSession = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to accept first
        const response = await fetch(
          `/api/v1/bookings/${bookingId}/sessions/${sessionId}/accept`,
          { method: 'POST', credentials: 'include' }
        );

        if (response.status === 410) {
          // Window expired
          setError('Session acceptance window expired');
          return;
        }

        if (response.status === 400) {
          // Already accepted, get token
          const tokenResponse = await fetch(
            `/api/v1/bookings/${bookingId}/sessions/${sessionId}/livekit-token`,
            { credentials: 'include' }
          );
          if (!tokenResponse.ok) throw new Error('Failed to get token');
          setData(await tokenResponse.json());
        } else if (response.ok) {
          // Accepted successfully
          setData(await response.json());
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
  }, [bookingId, sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="spinner"></div>
          <p>Initializing session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="bg-white p-8 rounded shadow">
          <h1 className="text-red-600 font-bold mb-4">Error</h1>
          <p className="mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div>No data</div>;
  }

  return (
    <SessionVideoComponent
      bookingId={bookingId!}
      sessionId={sessionId!}
      initialToken={data.token}
      initialRoomName={data.room_name}
      liveKitUrl={data.livekit_url}
    />
  );
}
```

---

### 3. Socket.IO Connection Monitoring

```typescript
// Example: Monitor Socket.IO connection state

import { useEffect } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useToast } from '@/hooks/useToast';

export function ConnectionMonitor() {
  const { socket, isConnected } = useSocket();
  const { showToast } = useToast();

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('✅ Socket.IO connected');
      showToast('Connected', 'success');
    };

    const handleDisconnect = () => {
      console.log('❌ Socket.IO disconnected');
      showToast('Disconnected', 'warning');
    };

    const handleError = (error: any) => {
      console.error('Socket.IO error:', error);
      showToast('Connection error', 'error');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
    };
  }, [socket, showToast]);

  return (
    <div className="fixed top-4 right-4 p-2 rounded bg-gray-800 text-white text-sm">
      Socket.IO: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
    </div>
  );
}
```

---

### 4. Error Handling Patterns

```typescript
// Common error handling patterns

enum SyncErrorType {
  WINDOW_EXPIRED = "WINDOW_EXPIRED", // 403
  SESSION_GONE = "SESSION_GONE", // 410
  NETWORK_ERROR = "NETWORK_ERROR", // fetch fails
  INVALID_STATUS = "INVALID_STATUS", // 400
  UNAUTHORIZED = "UNAUTHORIZED", // 403 permission
  INTERNAL_ERROR = "INTERNAL_ERROR", // 500
}

function getSyncErrorType(response: Response): SyncErrorType {
  if (response.status === 403) return SyncErrorType.WINDOW_EXPIRED;
  if (response.status === 410) return SyncErrorType.SESSION_GONE;
  if (response.status === 400) return SyncErrorType.INVALID_STATUS;
  if (response.status === 401) return SyncErrorType.UNAUTHORIZED;
  return SyncErrorType.INTERNAL_ERROR;
}

function getErrorMessage(type: SyncErrorType): string {
  switch (type) {
    case SyncErrorType.WINDOW_EXPIRED:
      return "Session window has expired";
    case SyncErrorType.SESSION_GONE:
      return "Session is no longer available";
    case SyncErrorType.NETWORK_ERROR:
      return "Network connection lost";
    case SyncErrorType.INVALID_STATUS:
      return "Session is in an invalid state";
    case SyncErrorType.UNAUTHORIZED:
      return "You do not have access to this session";
    default:
      return "An error occurred while syncing";
  }
}

function shouldRedirectToDashboard(type: SyncErrorType): boolean {
  return [
    SyncErrorType.WINDOW_EXPIRED,
    SyncErrorType.SESSION_GONE,
    SyncErrorType.UNAUTHORIZED,
  ].includes(type);
}
```

---

## Database Query Examples

### Session Status Transitions

```python
# Query: Find all sessions by status
from sqlalchemy import select
from app.models.booking import Session
from app.core.enums import SessionStatus

# All sessions awaiting webhook transition (window where READY, not yet IN_PROGRESS)
pending_sessions = await db.execute(
    select(Session).where(
        Session.status == SessionStatus.READY
    )
)

# All active sessions (currently in progress)
active_sessions = await db.execute(
    select(Session).where(
        Session.status == SessionStatus.IN_PROGRESS
    )
)

# Sessions that should be completed but aren't
from datetime import datetime, timezone, timedelta

stale_sessions = await db.execute(
    select(Session).where(
        (Session.status == SessionStatus.IN_PROGRESS) &
        (Session.actual_start_at < datetime.now(tz=timezone.utc) - timedelta(hours=2))
    )
)
```

---

## Monitoring & Logging

### Key Metrics to Track

```python
# In your logging/monitoring system:

# 1. Session acceptance timing
log.info(f"Session accepted in {(acceptance_time - initiation_time).total_seconds()}s")

# 2. Leniency buffer usage
elapsed = (current_time - session.actual_start_at).total_seconds()
buffer_remaining = (allowed_end_time - current_time).total_seconds()
log.info(f"Session elapsed: {elapsed}s, buffer remaining: {buffer_remaining}s")

# 3. Redis key operations
log.debug(f"Set pending_session:{booking_id}, ttl=60s")
log.debug(f"Cleared pending_session:{booking_id}")

# 4. Socket.IO events
log.info(f"Emitted session_ready to teacher {teacher_id}")

# 5. Sync endpoint calls
log.info(f"Sync called by {user_id} for session {session_id}")
```

---

## Edge Cases & Solutions

### Edge Case 1: Clock Skew

```python
# Problem: Server clock differs from client
# Solution: Add 5-second buffer
CLOCK_SKEW_BUFFER = 5  # seconds

if now + timedelta(seconds=CLOCK_SKEW_BUFFER) > allowed_end_time:
    raise HTTPException(403, "Session expired")
```

### Edge Case 2: Redis Unavailable

```python
# Problem: Redis connection fails
# Solution: Fall back to database check
try:
    pending = await get_pending_session_key(booking_id)
except RedisError:
    # Fall back to database timestamp check
    if session.teacher_initiated_at:
        elapsed = datetime.now(tz=timezone.utc) - session.teacher_initiated_at
        if elapsed > timedelta(minutes=1):
            raise HTTPException(410, "Window expired")
```

### Edge Case 3: Duplicate Accept Calls

```python
# Problem: Student clicks accept button twice
# Solution: Check for idempotency (session already READY or later)
if session.status in (SessionStatus.READY, SessionStatus.IN_PROGRESS, SessionStatus.COMPLETED):
    # Already accepted, return existing data
    return existing_response

# Only process if session doesn't exist or can be created
if session and session.status not in (None,):
    raise HTTPException(400, "Cannot accept in this status")
```

---

## Performance Optimization Tips

1. **Redis Key Expiry** — Use TTL to auto-cleanup
2. **Connection Pooling** — LiveKit and Redis both use connection pools
3. **Token Caching** — Cache token for 30s to reduce generation calls
4. **Batch Queries** — Load session + booking in single query
5. **Async All The Way** — No blocking I/O in hot paths

```python
# Example: Efficient session query with joins
session = await db.execute(
    select(Session)
    .join(Booking)
    .where(Session.id == session_id)
    .options(selectinload(Session.booking))  # Eager load
)

# Single query, avoids N+1
```

---

## Deployment Checklist

```bash
# 1. Pre-deployment
- [ ] All tests passing: pytest tests/
- [ ] Lint passing: pylint app/
- [ ] Type checking: mypy app/
- [ ] Frontend build: npm run build

# 2. Staging
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Run smoke tests
- [ ] Monitor logs for errors

# 3. Production
- [ ] Blue-green deployment
- [ ] Monitor Redis memory usage
- [ ] Monitor Socket.IO connections
- [ ] Monitor error rates
- [ ] Gradual rollout (10% → 25% → 50% → 100%)

# 4. Post-deployment
- [ ] Check key metrics (latency, errors, sync calls)
- [ ] Gather user feedback
- [ ] Keep deployment ready for quick rollback
```

---

**Last Updated:** March 26, 2026
