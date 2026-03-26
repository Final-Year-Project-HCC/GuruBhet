# 🚨 Error Handling Guide

**For:** Frontend developers debugging connection issues  
**Time:** 15 minutes  
**Reference:** All error codes and handling patterns

---

## HTTP Error Codes

The backend returns specific HTTP status codes for session sync scenarios. Your frontend must handle each correctly.

### 200 OK ✅

**When:** Session exists, is active, and you're within the leniency window  
**What to do:** Update token and continue

```typescript
if (response.status === 200) {
  const data = await response.json();
  setToken(data.token);
  setRoomName(data.room_name);
  showToast("Reconnected", "success");
}
```

---

### 400 Bad Request

**When:**

- Booking ID or session ID is invalid format
- Session doesn't exist
- Booking doesn't exist

**What to do:** Redirect to dashboard and show error

```typescript
if (response.status === 400) {
  showToast("Invalid session or booking", "error");
  router.push("/dashboard?error=invalid_session");
}
```

---

### 403 Forbidden ⏰

**When:** Session exists but you're **outside the leniency window**

**Example:**

- Session started at 10:00
- Duration: 60 minutes
- Leniency: 4 minutes (60 / 15)
- Now: 10:05 (within window) ✅
- Now: 11:06 (outside window - 66 minutes > 60+4) ❌

**What to do:** Session window CLOSED - redirect to dashboard

```typescript
if (response.status === 403) {
  showToast("Session window has expired. Cannot rejoin.", "warning");
  router.push("/dashboard?reason=session_expired");
  // Don't retry - user missed their session
}
```

**User message:** "Your session window closed. The class has ended."

---

### 410 Gone 🗑️

**When:** Session initialization window expired (60 seconds)

**Scenario:**

1. Teacher calls POST `/start-session` → Redis key set (60 seconds)
2. Student takes 2 minutes to accept
3. POST `/accept` comes after 60 seconds
4. Backend checks: Redis key expired → 410

**What to do:** Session window expired - redirect to dashboard

```typescript
if (response.status === 410) {
  showToast("Session window expired. Ask teacher to start again.", "error");
  router.push("/dashboard?reason=session_gone");
  // User must ask teacher to start fresh
}
```

**User message:** "Session request expired. Ask your teacher to start again."

---

### 500 Internal Server Error

**When:** Backend error (database, LiveKit, etc.)

**What to do:** Show error and suggest retry

```typescript
if (response.status === 500) {
  showToast("Server error. Please try again.", "error");
  // User can retry manually or wait for auto-reconnect
}
```

---

## Network Errors

When fetch() fails entirely (no HTTP response):

```typescript
async function sync() {
  try {
    const response = await fetch("/api/v1/bookings/123/sync");
    // ... handle response codes
  } catch (error) {
    // Network error, timeout, etc.
    if (error instanceof TypeError) {
      console.error("Network error:", error.message);
      showToast("Network error. Retrying...", "warning");
      // useSessionSync will retry on reconnect
    }
  }
}
```

---

## Socket.IO Disconnection

When Socket.IO reconnects automatically:

```typescript
const handleConnect = () => {
  console.info("Socket reconnected");
  // Automatically call sync()
  sync();
};

socket.on("connect", handleConnect);
```

**What happens:**

1. User's network goes down
2. Socket.IO detects disconnect
3. Socket.IO auto-reconnects when network recovers
4. useSessionSync hook listens for 'connect' event
5. Automatically calls sync() to refresh token
6. If sync succeeds (200) → update token, continue
7. If sync fails (410/403) → redirect appropriately

---

## LiveKit Room Errors

LiveKit can throw errors at the room level:

```typescript
<LiveKitRoom
  onError={(error) => {
    console.error('LiveKit error:', error);

    if (error.code === 'COULD_NOT_PARSE_INVITE') {
      showToast('Invalid session token. Reconnecting...', 'warning');
      sync(); // Try to get fresh token
    }

    if (error.code === 'ROOM_NOT_FOUND') {
      showToast('Room was deleted. Returning to dashboard.', 'error');
      router.push('/dashboard');
    }

    if (error.code === 'NO_VALID_ICE_CANDIDATE') {
      showToast('Network connectivity issue. Retrying...', 'warning');
      // Socket.IO will reconnect and trigger sync()
    }
  }}
/>
```

---

## Error Decision Tree

```
┌─ User sees video broken
│
├─ Network down?
│  ├─ YES → Socket.IO auto-reconnects → useSessionSync auto-syncs
│  └─ NO → Check console
│
├─ HTTP 200 on sync?
│  ├─ YES → Token updated, video should work
│  └─ NO → Check HTTP code
│
├─ HTTP 403 (Expired)?
│  └─ Redirect to /dashboard (session window closed)
│
├─ HTTP 410 (Gone)?
│  └─ Redirect to /dashboard (initialization window expired)
│
├─ HTTP 400 (Bad Request)?
│  └─ Redirect to /dashboard (invalid IDs)
│
├─ HTTP 500 (Server Error)?
│  └─ Show error, suggest retry or refresh
│
└─ No HTTP response (network error)?
   └─ Wait for Socket.IO reconnect (auto-retry)
```

---

## Debugging Checklist

**Before asking for help, check:**

```bash
# 1. Console logs
# Open DevTools → Console tab

✅ "[useSessionSync] Sync successful" → Working fine
❌ "[useSessionSync] Sync failed: 403" → Session expired
❌ "[useSessionSync] Sync failed: 410" → Initialization window closed
❌ "Network error" → Internet connection issue

# 2. Network tab
# Open DevTools → Network tab
# Filter to "sync" or "accept"

✅ GET /sync → 200 OK → Sync working
❌ GET /sync → 403 Forbidden → Session expired
❌ GET /sync → 410 Gone → Initialization window expired
❌ GET /sync → (gray row, no response) → Network offline

# 3. Socket.IO connection
# Open DevTools → Console

const socket = window.io;
console.log('Connected:', socket.connected);
socket.on('connect', () => console.log('Socket connected!'));
```

---

## Common Issues & Solutions

### Issue: "Session window has expired" on /sync

**Cause:** More than 60 + (duration / 15) minutes since session start  
**Solution:** Explain to user: "Class has ended, you can't rejoin"

---

### Issue: "Session window expired" immediately on accept

**Cause:** More than 60 seconds since teacher called POST /start-session  
**Solution:** Explain to user: "Start was too long ago, ask teacher to start again"

---

### Issue: Manual reconnect button does nothing

**Causes:**

1. sync() is still running from previous attempt
2. API endpoint is returning error
3. JavaScript error in useSessionSync

**Debug:**

```typescript
// Add logging to useSessionSync
const sync = useCallback(async () => {
  console.log("[SYNC] Starting...");

  if (syncInProgressRef.current) {
    console.log("[SYNC] Already in progress, skipping");
    return;
  }

  syncInProgressRef.current = true;
  try {
    // ... rest of logic
    console.log("[SYNC] Success");
  } catch (error) {
    console.error("[SYNC] Error:", error);
  } finally {
    syncInProgressRef.current = false;
  }
}, [...deps]);
```

---

### Issue: "Reconnected" toast but video still black

**Causes:**

1. Token updated but LiveKit room not re-initialized
2. Browser cache issue with old token
3. LiveKit server issue

**Solutions:**

```typescript
// Force re-render by updating key
const [componentKey, setComponentKey] = useState(0);

const handleSyncSuccess = (data) => {
  setToken(data.token);
  setRoomName(data.room_name);
  // Force re-render
  setComponentKey(prev => prev + 1);
};

return (
  <div key={componentKey}>
    <LiveKitRoom token={token} roomName={roomName}>
      ...
    </LiveKitRoom>
  </div>
);
```

---

### Issue: "Cannot find module" errors in TypeScript

**Cause:** Missing types  
**Solution:**

```bash
npm install --save-dev @types/node
npm install --save-dev @types/react
npm install --save-dev @types/next
```

---

### Issue: Socket.IO doesn't trigger reconnect

**Cause:**

- Socket.IO not imported in component
- Socket.IO not configured in app
- Event listener not attached

**Check:**

```typescript
// In component
import { useSocket } from "@/contexts/SocketContext";

// Use it
const { socket } = useSocket();

if (!socket) {
  console.error("Socket not available!");
  return null;
}
```

---

### Issue: CORS errors on /sync endpoint

**Cause:** Backend Socket.IO CORS not configured  
**Solution:** In backend `app/core/socketio.py`:

```python
sio = AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Or specific domain
    # ...
)
```

---

### Issue: LiveKit connection keeps dropping

**Causes:**

1. Token expired
2. Room was deleted on backend
3. Network instability
4. WebRTC ICE candidate issues

**Solutions:**

```typescript
const handleRoomError = (error) => {
  if (error.code === "ROOM_NOT_FOUND") {
    router.push("/dashboard");
  } else {
    // Try reconnect
    sync();
  }
};
```

---

## Testing Error Scenarios

### Test 410 (Initialization Window Expired)

```bash
# Backend
# In app/api/v1/endpoints/bookings.py, POST /accept:
# Change: if not pending_key: raise HTTPException(status_code=410)
# To: raise HTTPException(status_code=410)  # Always

# Frontend
# Navigate to /session/[id]/[id]
# Should show: "Session window expired"
# Should redirect to: /dashboard?reason=session_gone
```

### Test 403 (Session Expired)

```bash
# Backend
# In app/api/v1/endpoints/bookings.py, GET /sync:
# Change: if now > actual_start + grace: raise HTTPException(403)
# To: raise HTTPException(status_code=403)  # Always

# Frontend
# Navigate to /session/[id]/[id]
# Click reconnect after session accepts
# Should show: "Session window has expired"
# Should redirect to: /dashboard?reason=session_expired
```

### Test Network Failure

```bash
# Browser DevTools → Network tab
# Right-click → Offline
# UI should show warning toasts
# Click online
# Socket.IO should auto-reconnect
# useSessionSync should auto-call sync()
```

---

## Error Message Copy

Use these exact messages for consistency:

```typescript
const ERROR_MESSAGES = {
  SESSION_EXPIRED: "Session window has expired. Cannot rejoin.",
  SESSION_GONE: "Session request expired. Ask your teacher to start again.",
  INVALID_SESSION: "Invalid session or booking.",
  NETWORK_ERROR: "Network error. Retrying...",
  SERVER_ERROR: "Server error. Please try again.",
  RECONNECTING: "Reconnecting to session...",
  RECONNECTED: "Reconnected to session",
  CONNECTED: "Connected to session",
};
```

---

## Next Steps

- [ ] Read `TESTING-GUIDE.md` for unit test patterns
- [ ] Read `CODE-EXAMPLES.md` for copy-paste error handling
- [ ] Test all error scenarios in browser
- [ ] Add error logging to your monitoring (Sentry, etc.)
- [ ] Train support team on error messages

---

**Questions?** Check `README.md` or `TROUBLESHOOTING.md`
