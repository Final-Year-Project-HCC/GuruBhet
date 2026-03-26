# 🏗️ Frontend Architecture Overview

**Target Audience:** Frontend developers  
**Read Time:** 15 minutes  
**Prerequisite:** Understand the basic flow from `00-START-HERE.md`

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Frontend)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Session Page                                               │
│  /session/[bookingId]/[sessionId]                          │
│  └─ OnMount: POST /accept                                   │
│  └─ If error: Show message or fallback                      │
│  └─ If success: Render SessionVideoComponent                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SessionVideoComponent                                │  │
│  │  ├─ useSessionSync hook (listens Socket events)       │  │
│  │  ├─ <LiveKitRoom> with token                          │  │
│  │  ├─ Loading/Error states                              │  │
│  │  └─ "🔄 Reconnect" button                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                      │
│                ┌──────▼────────┐                            │
│                │ useSessionSync │                            │
│                │     Hook       │                            │
│                ├────────────────┤                            │
│                │ • Listen       │                            │
│                │   socket       │                            │
│                │   'connect'    │                            │
│                │ • Auto-call    │                            │
│                │   /sync on     │                            │
│                │   reconnect    │                            │
│                │ • Handle 410   │                            │
│                │   403 errors   │                            │
│                │ • Provide      │                            │
│                │   sync()       │                            │
│                │   function     │                            │
│                └─────┬──────────┘                            │
│                      │                                       │
│          ┌───────────┼───────────┐                          │
│          │           │           │                          │
│      Socket.IO    Fetch API   React State                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    Socket.IO      FastAPI      LiveKit
    Server         Server       (Video)
                   Endpoints:
                   • POST /accept
                   • GET /sync
```

---

## Data Flow Diagram

### Initial Session Load

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                   Session Page Loads                        │
│                          │                                  │
│          useSessionSync Hook Initializes                   │
│          (listens for socket 'connect')                     │
│                          │                                  │
│          POST /bookings/{id}/sessions/{sid}/accept          │
│                          │                                  │
└────────────────┬─────────────────────────────┬──────────────┘
                 │                             │
              Success                        Error
              (200 OK)                    (410 Gone)
                 │                             │
            {token,                    Show error
             room_name,               "Window
             livekit_url}             expired"
                 │                     │
          ┌─────▼──────┐         Redirect to
          │ Render      │         /dashboard
          │ <LiveKitRM> │
          │ with token  │
          └─────┬──────┘
                │
          Connect to
          LiveKit room
                │
          Video starts! ✅
```

### Network Reconnection

```
┌──────────────────────────────────┐
│   During Session (Connected)     │
│   Video streaming, user happy    │
└──────────────────────────────────┘
         │
   Network Failure
   (WiFi drops, etc.)
         │
    Socket.IO: 'disconnect'
         │
    ┌────▼─────────────────┐
    │ useSessionSync Hook   │
    │ Detects disconnect    │
    │ Shows "Reconnecting"  │
    │ Waits for reconnect   │
    └────┬─────────────────┘
         │
   (Wait for network...)
         │
    Socket.IO: 'connect'
         │
    ┌────▼──────────────────────┐
    │ useSessionSync Hook Fires  │
    │ Auto-calls GET /sync       │
    └────┬──────────────────────┘
         │
    ┌────▼────────────────────────────┐
    │ GET /bookings/{id}/sync          │
    │ Check: within window+leniency? ✅│
    │ Return: fresh token              │
    └────┬────────────────────────────┘
         │
    {token,
     room_name,
     livekit_url}
         │
    ┌────▼──────────────────────┐
    │ SessionVideoComponent      │
    │ Updates token in state     │
    │ LiveKit reinitializes      │
    │ New connection with token  │
    └────┬──────────────────────┘
         │
    Video resumes! ✅
```

---

## Component Hierarchy

```
<App>
  ├─ <LiveKitProvider>        (provides useLiveKit context)
  │  ├─ <SocketProvider>      (provides socket context)
  │  ├─ <ToastProvider>       (provides toast notifications)
  │  └─ <Router>
  │     └─ /session/[bookingId]/[sessionId]
  │        ├─ (component: SessionPage)
  │        │  ├─ State: sessionData, loading, error
  │        │  ├─ useEffect: POST /accept on mount
  │        │  └─ Render: <SessionVideoComponent>
  │        │
  │        └─ <SessionVideoComponent>
  │           ├─ Props: bookingId, sessionId, token, room, url
  │           ├─ State: token, roomName, isReady
  │           ├─ Watches: liveKitConfig (from useLiveKit)
  │           ├─ useSessionSync hook (initializes)
  │           │  ├─ Listens: socket.on('connect')
  │           │  ├─ onSuccess: Calls initializeLiveKit()
  │           │  ├─ onExpired: Redirects to /dashboard
  │           │  └─ Provides: sync() function
  │           ├─ Render: <LiveKitRoom>
  │           ├─ Render: "🔄 Reconnect" button
  │           └─ Render: Loading/Error states
```

---

## State Management Architecture

The app uses three context providers:

1. **LiveKitProvider** - Manages LiveKit token & room globally
   - Used by: useSessionSync (writes), SessionVideoComponent (reads)
   - Why: Prevents prop drilling, centralizes reconnection logic

2. **SocketProvider** - Manages Socket.IO connection
   - Used by: useSessionSync (listens to connect events)
   - Why: Real-time reconnection triggers

3. **ToastProvider** - Manages notifications
   - Used by: useSessionSync, SessionVideoComponent
   - Why: User feedback for errors and status

---

## Hook Data Flow

### useSessionSync Hook

```
┌─────────────────────────────────────────────────┐
│         useSessionSync Hook                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ Input (options):                                │
│ ├─ onSuccess: (data) => void                    │
│ ├─ onExpired: () => void                        │
│ ├─ onError: (error) => void                     │
│ └─ autoReconnect: boolean                       │
│                                                 │
│ State:                                          │
│ ├─ currentBookingId (from booking context)      │
│ ├─ socket (from socket context)                 │
│ ├─ initializeLiveKit (from useLiveKit)          │
│ └─ syncInProgress (prevent duplicate calls)     │
│                                                 │
│ Functions:                                      │
│ └─ sync(): Promise<LiveKitToken> {              │
│    ├─ GET /bookings/{id}/sync                   │
│    ├─ Handle 403 (expired) → onExpired()        │
│    ├─ Handle 410 (gone) → onExpired()           │
│    ├─ Handle 200 (success) → onSuccess(data)    │
│    └─ Return LiveKitToken                       │
│    }                                             │
│                                                 │
│ Effects:                                        │
│ └─ useEffect(() => {                            │
│    socket.on('connect', () => {                 │
│      if (autoReconnect) sync()                  │
│    })                                           │
│   }, [socket, autoReconnect])                   │
│                                                 │
│ Output:                                         │
│ └─ { sync: () => Promise }                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## State Management Strategy

### SessionPage State

```typescript
interface SessionPageState {
  sessionData: {
    token: string;
    room_name: string;
    livekit_url: string;
  } | null;
  loading: boolean; // While fetching /accept
  error: string | null; // Error message
}
```

### SessionVideoComponent State

```typescript
interface SessionVideoComponentState {
  token: string; // Current LiveKit token
  roomName: string; // Current room name
  isReady: boolean; // Ready to connect
}

// useSessionSync provides updates:
const { sync } = useSessionSync({
  onSuccess: (data) => {
    setToken(data.token); // Update token
    setRoomName(data.room_name); // Update room
    setIsReady(true); // Trigger re-render
  },
});
```

---

## Error Handling Strategy

```
┌─────────────────────────────────┐
│   API Call (POST /accept)       │
└──────────┬──────────────────────┘
           │
    ┌──────┴──────┐
    │             │
   Success      Error
    │             │
   200          410
    │          (Gone)
    │             │
    │        Error Message:
    │        "Window expired,
    │         ask teacher to
    │         start again"
    │             │
    │         Toast Notify
    │             │
    │         Redirect to
    │         /dashboard
    │
  Get token
    │
  Render component
    │
  Connect to room
```

---

## Socket.IO Event Flow

### Connect Event (Reconnection)

```
Socket.IO Server
    │
    ├─ Client disconnected
    │  (network glitch)
    │
    ├─ Client reconnected
    │  (network recovered)
    │
    └─ Emit: 'connect' event
            │
            ▼
       Browser receives
       'connect' event
            │
            ▼
       useSessionSync
       detects event
            │
            ├─ Check: autoReconnect === true ✓
            │
            ├─ Check: currentBookingId exists ✓
            │
            └─ Call: sync()
                   │
                   ├─ GET /sync
                   │
                   ├─ Receive fresh token
                   │
                   └─ Call onSuccess()
                      │
                      ├─ Update token state
                      ├─ Trigger re-render
                      └─ LiveKit reconnect
```

---

## Request/Response Patterns

### POST /accept Request

```typescript
// Request
POST /api/v1/bookings/{bookingId}/sessions/{sessionId}/accept
Content-Type: application/json
Authorization: Bearer {token}

{}  // Empty body

// Response (200 OK)
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
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "livekit_url": "https://livekit.example.com"
}

// Response (410 Gone)
{
  "detail": "Session acceptance window expired. Teacher must initiate again."
}
```

### GET /sync Request

```typescript
// Request
GET /api/v1/bookings/{bookingId}/sync
Content-Type: application/json
Authorization: Bearer {token}

// Response (200 OK)
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "room_name": "session-{id}",
  "livekit_url": "https://livekit.example.com"
}

// Response (403 Forbidden)
{
  "detail": "Session window expired. Window closed at 2026-03-26T11:49:35Z"
}

// Response (410 Gone)
{
  "detail": "No active session found"
}
```

---

## Performance Targets

| Operation           | Target | How              |
| ------------------- | ------ | ---------------- |
| API Call            | <500ms | Network + DB     |
| Token Update        | <100ms | State update     |
| Component Re-render | <200ms | React rendering  |
| LiveKit Reconnect   | <2s    | Network + server |
| Full Recovery       | <3s    | All combined     |

---

## Security Considerations

✅ **JWT Token**

- Signed by LiveKit server
- Includes user identity
- Expires per LiveKit config
- Never exposed in URL

✅ **Authorization**

- Checked on every API call
- User must be in booking
- Session must be active

✅ **CORS**

- Frontend origin whitelisted
- Credentials sent in requests
- Socket.IO configured

---

## TypeScript Types

```typescript
// API Response
interface LiveKitToken {
  token: string;
  room_name: string;
  livekit_url: string;
}

// Session Data
interface SessionData extends LiveKitToken {
  id: string;
  booking_id: string;
  session_number: number;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
  livekit_room_name: string;
  teacher_initiated_at: string | null;
  student_accepted_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
}

// Hook Options
interface SyncOptions {
  onSuccess?: (data: LiveKitToken) => void;
  onExpired?: () => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
}

// Hook Return
interface UseSessionSyncReturn {
  sync: () => Promise<LiveKitToken>;
}
```

---

## Key Points to Remember

✅ **Three API States**

- Loading (waiting for response)
- Success (got token, show video)
- Error (show message, maybe redirect)

✅ **Two Components**

- SessionPage: Gets initial token via POST /accept
- SessionVideoComponent: Manages token updates via useSessionSync

✅ **One Hook**

- useSessionSync: Listens for Socket reconnect, auto-syncs

✅ **Error Codes Matter**

- 410: Session/window doesn't exist
- 403: Session exists but window closed
- 400: Bad request (wrong status, etc.)

✅ **Always Handle Errors**

- Don't ignore 410/403
- Always show user-friendly message
- Always redirect on critical errors

---

## Next Steps

→ **Ready to implement?** Go to `IMPLEMENTATION-GUIDE.md`  
→ **Want more details?** Read `HOOKS-GUIDE.md` and `COMPONENTS-GUIDE.md`  
→ **Need code?** Check `CODE-EXAMPLES.md`

---

**Created:** March 26, 2026  
**Version:** 1.0  
**Status:** Ready to Implement
