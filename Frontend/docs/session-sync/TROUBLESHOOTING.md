# 🔧 Troubleshooting Guide

**For:** Developers debugging session sync issues  
**Time:** 10 minutes  
**Updated:** Based on real issues from testing

---

## Issue: "Module not found" errors

### ❌ Error message

```
Module not found: Can't resolve '@/hooks/useSessionSync'
```

### ✅ Solutions

**1. Check file exists**

```bash
ls -la src/hooks/useSessionSync.ts
```

**2. Check import path is correct**

```typescript
// ❌ WRONG
import { useSessionSync } from "@hooks/useSessionSync";
import { useSessionSync } from "./hooks/useSessionSync";

// ✅ CORRECT
import { useSessionSync } from "@/hooks/useSessionSync";
```

**3. Check tsconfig.json alias**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**4. Restart dev server**

```bash
npm run dev
```

---

## Issue: "Cannot find module 'react'" or other peer dependency

### ❌ Error message

```
Cannot find module 'react'
Cannot find module '@livekit/components-react'
```

### ✅ Solutions

**1. Install missing packages**

```bash
npm install react react-dom
npm install @livekit/components-react livekit-client
npm install socket.io-client
```

**2. Check node_modules exists**

```bash
ls -la node_modules/ | head -20
```

**3. Reinstall all dependencies**

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Issue: Socket.IO not connecting

### ❌ Symptoms

- useSessionSync hook doesn't auto-sync on reconnect
- Socket console shows "disconnect" repeatedly
- "Socket not available" warning in console

### ✅ Solutions

**1. Check Socket.IO is initialized in \_app.tsx**

```typescript
// ✅ CORRECT
import { SocketProvider } from '@/contexts/SocketContext';

function MyApp({ Component, pageProps }) {
  return (
    <SocketProvider>
      <Component {...pageProps} />
    </SocketProvider>
  );
}

export default MyApp;
```

**2. Check CORS is configured on backend**

In `backend/app/core/socketio.py`:

```python
sio = AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # Or specific domain
    # or
    cors_allowed_origins=['http://localhost:3000', 'https://yourdomain.com']
)
```

**3. Check Socket.IO server URL**

```typescript
// In SocketContext.tsx
const newSocket = io(process.env.NEXT_PUBLIC_API_URL, {
  // ...
});
```

**4. Check environment variable is set**

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**5. Check backend is running**

```bash
# Terminal 1
cd backend
python -m uvicorn app.main:app --reload
```

**6. Test Socket.IO in browser console**

```javascript
// Open DevTools → Console
const socket = io("http://localhost:8000");
socket.on("connect", () => console.log("Connected!"));
socket.on("disconnect", () => console.log("Disconnected"));
```

---

## Issue: useSessionSync hook throws "currentBookingId is undefined"

### ❌ Error message

```
TypeError: Cannot read property of undefined (reading 'currentBookingId')
```

### ✅ Solutions

**1. Check BookingProvider wraps app**

```typescript
// In pages/_app.tsx
import { BookingProvider } from '@/contexts/BookingContext';

function MyApp({ Component, pageProps }) {
  return (
    <SocketProvider>
      <BookingProvider>  {/* ← Must be present */}
        <Component {...pageProps} />
      </BookingProvider>
    </SocketProvider>
  );
}
```

**2. Set booking ID when entering session**

```typescript
// In SessionPage
const { setCurrentBookingId } = useBooking();

useEffect(() => {
  if (bookingId) {
    setCurrentBookingId(bookingId);
  }
}, [bookingId, setCurrentBookingId]);
```

**3. Check booking ID is in URL**

```
✅ CORRECT: /session/booking-123/session-456
❌ WRONG: /session
```

---

## Issue: GET /sync returns 403 immediately

### ❌ Symptoms

- Clicking "Reconnect" button shows "Session expired" immediately
- No error logs from backend

### ✅ Solutions

**1. Check session start time**

```python
# In backend, GET /sync endpoint
print(f"Session start: {session.actual_start}")
print(f"Duration: {session.duration_minutes}")
print(f"Now: {datetime.utcnow()}")
print(f"Leniency: {leniency}")
```

**2. Verify calculation is correct**

```python
# Should be: now <= actual_start + duration + leniency
# NOT: now >= actual_start + duration + leniency (common mistake)

if now > actual_start + duration + timedelta(minutes=leniency):
    raise HTTPException(status_code=403)  # ✅ CORRECT
```

**3. Check session is actually IN_PROGRESS or SCHEDULED**

```python
# Debug endpoint
@app.get('/api/v1/bookings/{booking_id}/debug')
async def debug_session(booking_id: str):
    session = await db.session.get(booking_id)
    return {
        'status': session.status,
        'actual_start': session.actual_start,
        'duration_minutes': session.duration_minutes,
        'now': datetime.utcnow(),
        'leniency_minutes': session.duration_minutes // 15,
        'will_expire_at': session.actual_start + timedelta(minutes=session.duration_minutes + session.duration_minutes // 15)
    }
```

**4. Check test data**

```bash
# In backend, manually check database
psql $DATABASE_URL

SELECT id, status, actual_start, duration_minutes FROM sessions LIMIT 5;
```

---

## Issue: POST /accept returns 410 (Gone)

### ❌ Symptoms

- Student tries to accept session immediately but gets 410
- Error: "Session window expired"

### ✅ Solutions

**1. Check teacher called POST /start-session**

First, teacher must call:

```
POST /api/v1/bookings/{booking_id}/start-session
```

This sets the Redis key with 60-second TTL.

**2. Check 60-second window hasn't elapsed**

```
Timeline:
10:00:00 - Teacher calls POST /start-session (Redis key set)
10:00:01 to 10:00:59 - Student can call POST /accept (✅ OK)
10:01:00 - Redis key expires
10:01:01+ - Student calls POST /accept (❌ 410 Gone)
```

**3. Verify Redis is working**

```bash
# In backend terminal
redis-cli

# Check if key exists
KEYS "*pending_session*"
GET pending_session:booking-123
TTL pending_session:booking-123  # Should be positive seconds
```

**4. Test with proper timing**

```bash
# Backend terminal
cd backend
python -c "
import asyncio
from app.utils.livekit import set_pending_session_key, get_pending_session_key
from app.db.redis import redis_client

async def test():
    # Set key
    await set_pending_session_key('booking-123', 'session-456', ttl=60)

    # Check immediately
    result = await get_pending_session_key('booking-123')
    print(f'Key exists: {result}')

    # Wait
    await asyncio.sleep(61)

    # Check after expiry
    result = await get_pending_session_key('booking-123')
    print(f'Key exists after 61s: {result}')

asyncio.run(test())
"
```

---

## Issue: LiveKit token is invalid

### ❌ Symptoms

- "Invalid token" error in console
- LiveKit room shows error: "COULD_NOT_PARSE_INVITE"
- Video doesn't load

### ✅ Solutions

**1. Check token is generated correctly**

```python
# In backend, add debug logging
from livekit import api

token = api.TokenWithGrant(...)
token_str = token.toJwt()

print(f"Token generated: {token_str[:50]}...")
print(f"Token length: {len(token_str)}")
```

**2. Check token wasn't corrupted in response**

```typescript
// In frontend
console.log("Token received:", data.token.substring(0, 50) + "...");
console.log("Token length:", data.token.length);
console.log("Token contains . (dots)?", data.token.includes("."));
```

**3. Check token algorithm**

```python
# In backend, tokens should be JWT format
# Decode and check payload

import jwt

token_str = "eyJ0eXAi..."
decoded = jwt.decode(token_str, options={"verify_signature": False})
print(decoded)  # Should show: {'video': {...}, 'iat': ..., 'exp': ...}
```

**4. Check LiveKit server URL**

```typescript
// In SessionVideoComponent
<LiveKitRoom
  serverUrl={liveKitUrl}  // ← Must be correct
  token={token}
  roomName={roomName}
/>
```

```bash
# Should be something like:
https://livekit.example.com
wss://livekit.example.com  # with wss:// for WebSocket
```

---

## Issue: Video doesn't appear after successful connection

### ❌ Symptoms

- No console errors
- Browser shows "Connected to session"
- Video pane is black
- Audio might work

### ✅ Solutions

**1. Check browser permissions**

- Allow camera access
- Allow microphone access
- Check DevTools > Permissions

**2. Check browser console for WebRTC errors**

```javascript
// Open DevTools → Console
// Look for errors containing:
// - "ICE"
// - "STUN"
// - "getUserMedia"
```

**3. Check LiveKit server is accessible**

```bash
# From your computer
curl -v wss://livekit.example.com/

# Should connect (may show upgrade error, but shouldn't timeout)
```

**4. Check room actually exists on LiveKit**

```python
# In backend, after creating room
from livekit import api

client = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
rooms = client.list_rooms()
print(f"Rooms: {[r.name for r in rooms]}")

# Should see the room name from session
```

**5. Force component re-render**

```typescript
// In SessionVideoComponent
const [componentKey, setComponentKey] = useState(0);

const handleSyncSuccess = (data) => {
  setToken(data.token);
  setRoomName(data.room_name);
  setComponentKey(prev => prev + 1);  // Force re-render
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

## Issue: "Cannot GET /api/v1/bookings/[id]/sync"

### ❌ Error message

```
404 Not Found
Cannot GET /api/v1/bookings/[id]/sync
```

### ✅ Solutions

**1. Check backend endpoint exists**

```bash
# In backend directory
grep -r "def sync" app/api/v1/endpoints/
```

**2. Check endpoint is registered in router**

```python
# In app/api/v1/endpoints/bookings.py
@router.get("/{booking_id}/sync")  # ← Must be present
async def sync_session(booking_id: str):
    ...
```

**3. Check route is included in API**

```python
# In app/api/v1/__init__.py
from .endpoints import bookings

router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
```

**4. Restart backend server**

```bash
# Kill and restart
Ctrl+C
python -m uvicorn app.main:app --reload
```

**5. Test endpoint with curl**

```bash
curl -X GET http://localhost:8000/api/v1/bookings/booking-123/sync \
  -H "Content-Type: application/json" \
  -c cookies.txt
```

---

## Issue: Network tab shows "canceled" request

### ❌ Symptoms

- Request appears in Network tab but is grayed out
- Shows "(canceled)" in status
- No error in console
- Happens intermittently

### ✅ Causes & Solutions

**1. Component unmounted before request completed**

- Solution: Use cleanup in useEffect

```typescript
useEffect(() => {
  let isMounted = true;

  const sync = async () => {
    const response = await fetch("/...");
    if (isMounted) {
      // Only update if still mounted
      setData(await response.json());
    }
  };

  sync();
  return () => {
    isMounted = false;
  };
}, []);
```

**2. AbortController was triggered**

- Check if something is aborting requests
- Look for `abort()` calls in your code

**3. Page navigation during request**

- Don't navigate while sync is in progress
- Solution: Don't navigate automatically, wait for user

---

## Issue: TypeScript errors in build

### ❌ Error message

```
Type 'LiveKitToken' is not assignable to type 'X'
```

### ✅ Solutions

**1. Rebuild TypeScript**

```bash
npm run build
```

**2. Check all imports are typed**

```typescript
// ❌ WRONG
import { useSessionSync } from "@/hooks/useSessionSync";
const { sync } = useSessionSync();
sync(); // Type: unknown

// ✅ CORRECT
import { useSessionSync, LiveKitToken } from "@/hooks/useSessionSync";
const { sync } = useSessionSync({
  onSuccess: (data: LiveKitToken) => {
    // data is properly typed
  },
});
```

**3. Check type exports**

```typescript
// In hook file
export interface LiveKitToken {
  token: string;
  room_name: string;
  livekit_url: string;
}

export function useSessionSync(...) { ... }
```

---

## Issue: Browser keeps showing "Reconnecting..."

### ❌ Symptoms

- Toast repeatedly says "Reconnecting..."
- Actually connected to video
- Happens on every network blip

### ✅ Causes & Solutions

**1. Socket.IO is disconnecting/reconnecting repeatedly**

Check:

```typescript
// In SocketContext.tsx
const newSocket = io(process.env.NEXT_PUBLIC_API_URL, {
  reconnection: true,
  reconnectionDelay: 1000, // 1 second before retry
  reconnectionDelayMax: 5000, // Max 5 seconds
  reconnectionAttempts: 5, // Give up after 5 attempts
  transports: ["websocket", "polling"], // Fallback to polling
});
```

**2. Lessen reconnection toasts**

```typescript
const handleConnect = () => {
  // Don't show toast on every reconnect
  sync(); // Just sync silently
  // showToast('Reconnected', 'success');  // ← Remove or make less noisy
};
```

**3. Add jitter to reconnection**

```typescript
const newSocket = io(process.env.NEXT_PUBLIC_API_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
```

---

## Issue: Debugging guide

### Browser DevTools Setup

**1. Console debugging**

```javascript
// Check socket connection
const socket = window.io;
console.log("Socket connected:", socket.connected);
console.log("Socket ID:", socket.id);

// Monitor events
socket.onAny((event, ...args) => {
  console.log(`Socket event: ${event}`, args);
});
```

**2. Network debugging**

```bash
# Open DevTools → Network tab
# Filter: "sync" or "accept"
# Click request to see:
# - Request headers
# - Response status
# - Response body
# - Cookies
```

**3. Local storage debugging**

```javascript
// Check stored session data
console.log(localStorage.getItem("session"));
console.log(sessionStorage);
```

**4. Verbose logging**

```typescript
// In useSessionSync hook
const sync = useCallback(async () => {
  console.log("[SYNC] Starting sync for booking:", currentBookingId);
  console.log("[SYNC] In progress?", syncInProgressRef.current);

  // ... rest of code

  console.log("[SYNC] Response status:", response.status);
  console.log("[SYNC] Response body:", data);
}, [...deps]);
```

---

## Checklist Before Asking For Help

- [ ] Checked browser console for JavaScript errors
- [ ] Checked Network tab for HTTP errors
- [ ] Checked backend logs: `tail -f docker logs`
- [ ] Tested endpoint with curl or Postman
- [ ] Restarted dev server and backend
- [ ] Cleared browser cache and local storage
- [ ] Checked all required packages are installed
- [ ] Verified environment variables are set
- [ ] Confirmed Socket.IO is connected
- [ ] Tested with different browser/device

---

## Get Help

If you've checked all of the above, gather:

1. **Frontend logs** - Copy full console output
2. **Backend logs** - Copy relevant error logs
3. **Network tab** - Screenshot of failed request details
4. **Steps to reproduce** - Exact steps to trigger the issue
5. **Environment info** - OS, browser, backend version

Then post to team chat or create an issue.

---

**Next:** See `ARCHITECTURE-OVERVIEW.md` for design details or `CODE-EXAMPLES.md` for working code
