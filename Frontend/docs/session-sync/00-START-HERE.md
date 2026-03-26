# 🚀 START HERE - Frontend Session Sync

**For:** Frontend developers implementing session sync  
**Time:** 10 minutes to read  
**Difficulty:** Medium

---

## What Is This?

A system for **resilient video sessions** that automatically reconnect when:

- Network drops
- User refreshes page
- Browser tab goes inactive
- Socket.IO disconnects

**Key Innovation:** User stays in session seamlessly while network recovers.

---

## How Does It Work? (Simple Version)

### Step 1: User Joins Session

```
User clicks "Join Session"
    ↓
Page loads /session/[bookingId]/[sessionId]
    ↓
useSessionSync hook starts
    ↓
POST /bookings/{id}/sessions/{sid}/accept
    ↓
Get: {token, room_name, livekit_url}
    ↓
Render <SessionVideoComponent>
    ↓
Connected to LiveKit room! 🎉
```

### Step 2: Network Glitch Happens

```
User on WiFi in session
    ↓
WiFi drops / Network unstable
    ↓
Socket.IO disconnects
    ↓
UI shows "Reconnecting..." toast
    ↓
(wait for network to recover)
```

### Step 3: Network Recovers

```
WiFi reconnects
    ↓
Socket.IO 'connect' event fires
    ↓
useSessionSync hook detects this
    ↓
Auto-calls GET /sync
    ↓
Get fresh token
    ↓
LiveKit reinitializes
    ↓
Video resumes! 🎉
```

---

## Three Files You Need to Create

### 1️⃣ Hook: `src/hooks/useSessionSync.ts`

**What it does:**

- Listens for Socket.IO reconnection
- Auto-calls `/sync` endpoint
- Handles errors (410, 403)
- Provides `sync()` for manual reconnect

**Size:** 130 lines

```typescript
// Pseudo-code
export function useSessionSync(options) {
  const sync = async () => {
    const response = await fetch(`/api/v1/bookings/${bookingId}/sync`);

    if (response.status === 410) {
      // Session expired
      redirect("/dashboard");
    }

    const data = await response.json();
    return data; // {token, room_name, livekit_url}
  };

  // Auto-sync on socket reconnect
  useEffect(() => {
    socket.on("connect", () => sync());
  }, []);

  return { sync };
}
```

### 2️⃣ Component: `src/components/SessionVideoComponent.tsx`

**What it does:**

- Wraps LiveKit room
- Manages token updates
- Shows reconnect button
- Handles loading/error states

**Size:** 130 lines

```typescript
// Pseudo-code
export function SessionVideoComponent({
  bookingId, sessionId, initialToken, initialRoomName, liveKitUrl
}) {
  const { config: liveKitConfig } = useLiveKit();
  const [token, setToken] = useState(initialToken);
  const [roomName, setRoomName] = useState(initialRoomName);

  // Watch for token updates from useSessionSync
  useEffect(() => {
    if (liveKitConfig) {
      setToken(liveKitConfig.token);
      setRoomName(liveKitConfig.roomName);
    }
  }, [liveKitConfig]);

  const { sync } = useSessionSync({
    onSuccess: (data) => {
      // Hook already called initializeLiveKit, which updated useLiveKit
      // useEffect above will trigger and update our local state
    },
  });

  return (
    <div>
      <button onClick={sync}>🔄 Reconnect</button>
      <LiveKitRoom token={token} roomName={roomName} />
    </div>
  );
}
```

### 3️⃣ Page: `src/pages/session/[bookingId]/[sessionId].tsx`

**What it does:**

- Entry point for session
- Calls POST `/accept` on load
- Handles 410 error
- Renders video component

**Size:** 160 lines

```typescript
// Pseudo-code
export default function SessionPage() {
  const { bookingId, sessionId } = router.query;
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    // POST /accept to get initial token
    fetch(`/api/v1/bookings/${bookingId}/sessions/${sessionId}/accept`, {
      method: 'POST',
    })
      .then(r => r.json())
      .then(data => setSessionData(data));
  }, []);

  return (
    <SessionVideoComponent
      bookingId={bookingId}
      sessionId={sessionId}
      initialToken={sessionData?.token}
      initialRoomName={sessionData?.room_name}
      liveKitUrl={sessionData?.livekit_url}
    />
  );
}
```

---

## Key Concepts

### Backend Endpoints You'll Call

| Endpoint                               | Method | When                | Returns                           |
| -------------------------------------- | ------ | ------------------- | --------------------------------- |
| `/bookings/{id}/sessions/{sid}/accept` | POST   | On page load        | `{token, room_name, livekit_url}` |
| `/bookings/{id}/sync`                  | GET    | On Socket reconnect | `{token, room_name, livekit_url}` |

### Error Codes You'll See

| Code | Meaning        | Action                |
| ---- | -------------- | --------------------- |
| 410  | Window expired | Redirect to dashboard |
| 403  | Session ended  | Redirect to dashboard |
| 200  | Success        | Continue with token   |

### What's a "Session Sync"?

When Socket.IO reconnects, the frontend calls `/sync` to:

1. **Check:** Is the session still active?
2. **Verify:** Within the time window?
3. **Get:** Fresh LiveKit token
4. **Resume:** Video streaming

---

## Implementation Checklist

- [ ] Understand the 3-file architecture
- [ ] Read `ARCHITECTURE-OVERVIEW.md` (15 min)
- [ ] Read `IMPLEMENTATION-GUIDE.md` (30 min)
- [ ] Create `useSessionSync.ts` (30 min)
- [ ] Create `SessionVideoComponent.tsx` (30 min)
- [ ] Create session page (30 min)
- [ ] Test in browser (30 min)
- [ ] Review error handling (15 min)
- [ ] Write unit tests (60 min)
- [ ] Deploy to staging (30 min)

**Total:** 4-5 hours

---

## Common Questions

### Q: Why do I need this hook?

**A:** Because networks are unreliable. Without auto-sync, users get disconnected and can't rejoin without reloading.

### Q: What if Socket.IO is not connected?

**A:** The endpoints still work! POST `/accept` and GET `/sync` work via HTTP even without Socket.

### Q: How do I test this?

**A:** See `TESTING-GUIDE.md` for unit and E2E examples.

### Q: What if the session expires?

**A:** You get 403 Forbidden. Redirect user to dashboard with error message.

### Q: Can I join before teacher?

**A:** Yes! Student can join as soon as they accept (POST `/accept`). Teacher joins whenever ready.

---

## Error Scenarios

### Scenario 1: Student Too Slow (>60 seconds)

```
Teacher: POST /start-session
[60 seconds pass]
Student: POST /accept
    ↓
Response: 410 Gone
    ↓
UI: Show "Window expired, ask teacher to start again"
    ↓
Redirect: /dashboard
```

### Scenario 2: Network Glitch During Session

```
User: Connected to video
Network: Drops
    ↓
UI: Show "Reconnecting..." toast
    ↓
Socket: Reconnects after 5s
    ↓
Hook: Detects reconnect
    ↓
API: GET /sync called
    ↓
Response: Fresh token
    ↓
LiveKit: Reconnect with new token
    ↓
Video: Resume streaming ✅
```

### Scenario 3: Session Ends

```
60-minute session finishes
    ↓
User still connected (4-minute grace period)
    ↓
User tries to do anything after 64 minutes total
    ↓
API: GET /sync returns 403 Forbidden
    ↓
UI: Show "Session ended" message
    ↓
Redirect: /dashboard
```

---

## Tips & Tricks

✅ **Use Socket.IO Context**  
Wrap your app with Socket.IO provider so all components can access socket.

✅ **Handle 410 Gracefully**  
Don't show technical error codes. Show user-friendly messages.

✅ **Test Network Failures**  
Open DevTools → Network → Offline mode to simulate network failure.

✅ **Add Loading States**  
Show spinner while waiting for POST `/accept` to complete.

✅ **Provide Reconnect Button**  
Let users manually sync if auto-sync fails (rare).

✅ **Monitor Socket Events**  
Add logging to socket events for debugging.

---

## Next Steps

### If You're Ready to Implement

1. Go to `IMPLEMENTATION-GUIDE.md`
2. Follow the step-by-step instructions
3. Copy code from `CODE-EXAMPLES.md`

### If You Want to Understand More

1. Read `ARCHITECTURE-OVERVIEW.md`
2. Check `HOOKS-GUIDE.md` and `COMPONENTS-GUIDE.md`
3. Review flow diagrams

### If You Hit Issues

1. Check `ERROR-HANDLING.md` for error codes
2. Review `TROUBLESHOOTING.md` for common problems
3. Look at `CODE-EXAMPLES.md` for working implementations

---

## Quick Reference

```typescript
// Hook usage
const { sync } = useSessionSync({
  onSuccess: (data) => console.log("Synced!", data),
  onExpired: () => redirect("/dashboard"),
  autoReconnect: true,
});

// Manual sync
await sync();
```

---

## File Navigator

```
You are here: 00-START-HERE.md ✅

Next: ARCHITECTURE-OVERVIEW.md (15 min)
Then: IMPLEMENTATION-GUIDE.md (start coding)

Also helpful:
  → HOOKS-GUIDE.md (hook deep dive)
  → COMPONENTS-GUIDE.md (component guide)
  → CODE-EXAMPLES.md (copy-paste code)
  → TESTING-GUIDE.md (unit & E2E tests)
  → ERROR-HANDLING.md (error codes)
  → TROUBLESHOOTING.md (debug tips)
```

---

**Ready to code?** → Open `ARCHITECTURE-OVERVIEW.md` next! 🚀
