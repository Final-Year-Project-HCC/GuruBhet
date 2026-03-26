# Architecture Diagrams

## 1. Message Flow Diagram (Database-First)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SENDING A MESSAGE                               │
└─────────────────────────────────────────────────────────────────────────┘

SENDER                          BACKEND                        RECEIVER
  │                               │                               │
  ├─ POST /messages ──────────→   │                               │
  │                               │                               │
  │                        ┌──────▼─────────┐                     │
  │                        │ Authenticate   │                     │
  │                        │ (JWT from      │                     │
  │                        │  HttpOnly      │                     │
  │                        │  cookie)       │                     │
  │                        └──────┬─────────┘                     │
  │                               │                               │
  │                        ┌──────▼─────────┐                     │
  │                        │ Validate       │                     │
  │                        │ inputs         │                     │
  │                        └──────┬─────────┘                     │
  │                               │                               │
  │                    DATABASE-FIRST PERSISTENCE                │
  │                        ┌──────▼─────────┐                     │
  │                        │ Save Message   │                     │
  │                        │ to PostgreSQL  │                     │
  │                        │ (GUARANTEED)   │                     │
  │                        └──────┬─────────┘                     │
  │                               │                               │
  │                        ┌──────▼─────────┐                     │
  │                        │ Get message.id │                     │
  │                        │ (flush)        │                     │
  │                        └──────┬─────────┘                     │
  │                               │                               │
  │                    REAL-TIME EMISSION (BEST-EFFORT)          │
  │                        ┌──────▼─────────┐                     │
  │                        │ Emit via       │────────────────→   │
  │                        │ Socket.IO      │  message_received  │
  │                        │ (best-effort)  │                     │
  │                        └──────┬─────────┘                     │
  │                               │                               │
  │                        ┌──────▼─────────┐                     │
  │                        │ Commit         │                     │
  │                        │ transaction    │                     │
  │                        └──────┬─────────┘                     │
  │                               │                               │
  │  ← 201 Created ─────────────   │                               │
  │    {id, timestamp, ...}        │                               │
  │                               │                               │
  │ FALLBACK (if no Socket.IO):   │                               │
  │                               │ (Receiver can fetch)          │
  │                        ┌──────▼──────────┐                    │
  │                        │ GET /messages   │◄──────────────────┤
  │                        │ Fetch from DB   │                    │
  │                        └─────────────────┘                    │
```

---

## 2. Socket.IO Connection Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SOCKET.IO CONNECTION (HANDSHAKE)                    │
└─────────────────────────────────────────────────────────────────────────┘

CLIENT                        BACKEND
  │                             │
  ├─ Connect with:             │
  │  {                          │
  │    withCredentials: true,   │  ← CRITICAL: Sends HttpOnly cookies
  │    ...                      │
  │  }                          │
  │                             │
  ├─ Send HTTP upgrade────────→ │
  │   (with cookies)            │
  │                             │
  │                    ┌────────▼──────────┐
  │                    │ Receive handshake │
  │                    │ headers           │
  │                    └────────┬──────────┘
  │                             │
  │                    ┌────────▼──────────┐
  │                    │ Extract token     │
  │                    │ from cookies      │
  │                    │ (not query param!)│
  │                    └────────┬──────────┘
  │                             │
  │                    ┌────────▼──────────┐
  │                    │ Verify JWT        │
  │                    │ signature         │
  │                    │ Validate exp.     │
  │                    └────────┬──────────┘
  │                             │
  │                    ┌────────▼──────────┐
  │                    │ Extract user_id   │
  │                    │ from "sub" claim  │
  │                    └────────┬──────────┘
  │                             │
  │                    ┌────────▼──────────┐
  │                    │ Store in Socket   │
  │                    │ session:          │
  │                    │ {user_id: "..."}  │
  │                    └────────┬──────────┘
  │                             │
  │                    ┌────────▼──────────┐
  │                    │ Track in          │
  │                    │ user_sessions:    │
  │                    │ {user_id →        │
  │                    │  [sid1, sid2]}    │
  │                    └────────┬──────────┘
  │                             │
  │                    ┌────────▼──────────┐
  │                    │ Join room:        │
  │                    │ "user_{user_id}"  │
  │                    └────────┬──────────┘
  │                             │
  │  ← connect_response ────────┤
  │    {status: connected,      │
  │     user_id: "...",         │
  │     sid: "..."}             │
  │                             │
  ✓ Connected and authenticated
```

---

## 3. HttpOnly Cookie Security

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HTTPONLY COOKIE SECURITY FLOW                        │
└─────────────────────────────────────────────────────────────────────────┘

LOGIN:
┌─────────────────┐         ┌──────────────────┐
│ POST /login     │────────→│ Backend          │
│ {email, pswd}   │         │ generates JWT    │
└─────────────────┘         └────────┬─────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │ Set-Cookie response header:   │
                    │ access_token={JWT};           │
                    │ HttpOnly;                     │
                    │ Secure;                       │
                    │ SameSite=Strict;              │
                    │ Path=/;                       │
                    │ Max-Age=1800                  │
                    └────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │ Browser stores cookie:        │
                    │ - HttpOnly flag:              │
                    │   ✓ Cannot be accessed by JS  │
                    │   ✓ Cannot be stolen by XSS   │
                    │ - Secure flag:                │
                    │   ✓ Only sent over HTTPS      │
                    │ - SameSite=Strict:            │
                    │   ✓ Not sent cross-site       │
                    │   ✓ CSRF protection           │
                    └────────────────────────────────┘

HTTP REQUEST:
┌─────────────────┐
│ POST /messages  │         Browser automatically
│                 │         adds cookie to request
└────────┬────────┘
         │
         ├─ HTTP Headers:
         │  Authorization: Cookie: access_token={JWT}
         │
         ├─────────────────────────────────────────→ Backend
         │
         └─ Backend middleware:
            CookieToHeaderMiddleware extracts token
            Sets header: x-access-token: {JWT}
            (for downstream auth logic)

SOCKET.IO CONNECTION:
┌─────────────────┐
│ io.connect()    │
│ {              │         Browser automatically
│  withCreds: ✓   │         includes cookies in
│ }              │         WebSocket upgrade
└────────┬────────┘
         │
         ├─ WebSocket Upgrade Headers:
         │  Cookie: access_token={JWT}
         │
         ├─────────────────────────────────────────→ Backend
         │
         └─ Backend middleware:
            extract_token_from_cookies() parses JWT
            verify_jwt_from_handshake() validates
            user_id extracted from "sub" claim

JAVASCRIPT CANNOT ACCESS:
┌────────────────────────────┐
│ document.cookie            │  Returns only non-HttpOnly cookies
│ // No access_token here!   │  XSS safe!
│                            │
│ localStorage.getItem(...)  │  Not using for tokens
│ // Good, nothing there     │  XSS safe!
└────────────────────────────┘
```

---

## 4. User Session Tracking

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      USER SESSION TRACKING                              │
└─────────────────────────────────────────────────────────────────────────┘

socketio_manager.user_sessions: dict[str, set[str]]
= {
    "user-1-uuid": {"sid-abc123", "sid-xyz789"},     ← Multiple tabs/devices
    "user-2-uuid": {"sid-def456"},                   ← Single session
    "user-3-uuid": set()                             ← Empty (disconnected)
  }

SCENARIO: User opens 2 tabs

Tab 1:
  ├─ Socket.IO connect ──→ backend
  ├─ Middleware extracts JWT ──→ user_id = "uuid-1"
  ├─ track_user_session("uuid-1", "sid-1")
  └─ Join room "user_uuid-1"

Tab 2:
  ├─ Socket.IO connect ──→ backend
  ├─ Middleware extracts JWT ──→ user_id = "uuid-1"
  ├─ track_user_session("uuid-1", "sid-2")
  └─ Join room "user_uuid-1"

Result in socketio_manager:
  user_sessions["uuid-1"] = {"sid-1", "sid-2"}

BROADCAST MESSAGE FROM TAB 1:
  ├─ emit_to_user("uuid-2", "message_received", {...})
  │  └─ Internally does: emit(event, data, room="user_uuid-2")
  │     └─ All sids in {"sid-1", "sid-2"} receive message

TAB 1 CLOSES:
  ├─ disconnect event ──→ backend
  ├─ untrack_user_session("uuid-1", "sid-1")
  │  └─ Removes "sid-1" from set
  └─ Result: user_sessions["uuid-1"] = {"sid-2"}

TAB 2 STILL WORKS:
  └─ Messages can still be sent from Tab 2
  └─ Online status is still true (set is not empty)

BOTH TABS CLOSE:
  ├─ Tab 2 disconnect ──→ untrack_user_session("uuid-1", "sid-2")
  │  └─ Removes "sid-2", set is now empty
  └─ is_user_online("uuid-1") returns False
```

---

## 5. Database-First Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   DATABASE-FIRST TRANSACTION FLOW                       │
└─────────────────────────────────────────────────────────────────────────┘

SCENARIO: Send message

┌─ HTTP Handler                                   ┌─ Service Layer
│                                                 │
├─ Create async session (transaction starts)     │
│                                                 │
├──────────────────────────────────────┬─────────┼─→ save_and_send_message()
│                                      │         │
│  ┌────────────────────────────────────▼──────────┐
│  │ Create Message object                         │
│  │ db.add(message)                              │
│  │ await db.flush()    ← Written to DB (buffer) │
│  │ [message.id is now available]                │
│  └────────────────────┬──────────────────────────┘
│                       │
│  ┌────────────────────▼──────────────────────────┐
│  │ Emit Socket.IO event (best-effort)           │
│  │ await socketio_manager.emit_to_user(...)     │
│  │ If fails: log warning, continue              │
│  └────────────────────┬──────────────────────────┘
│                       │
│  Return message ◄─────┘
│
├─ Commit transaction
│  await db.commit()
│  ← All flush() changes are now permanent in DB
│
│ CRITICAL DISTINCTION:
│ ├─ DB write (flush): GUARANTEED ✓
│ └─ Socket.IO (emit): BEST-EFFORT (can fail)

WHAT IF THINGS GO WRONG:

1. Validation error (before flush):
   ├─ Raise exception
   ├─ Transaction rolls back (db.rollback())
   └─ No data in DB, no Socket.IO sent

2. Socket.IO fails (after flush):
   ├─ Log warning
   ├─ Continue (don't raise)
   ├─ Transaction commits
   └─ Data is SAFE in DB, emission just failed

3. Something else fails (after flush):
   ├─ Catch exception
   ├─ db.rollback() (undoes flush)
   └─ No data in DB, no Socket.IO sent

SEQUENCE GUARANTEE:
│
├─ flush() → Data visible in DB, can be queried
├─ Socket.IO emission → Best-effort real-time delivery
├─ commit() → Makes flush permanent (or rollback undoes it)
│
└─ Result:
   ✓ Data durability: Always in DB after commit
   ✓ Real-time delivery: Best-effort, not guaranteed
   ✓ Fallback: Recipients can GET /messages to fetch
```

---

## 6. Message Delivery Paths

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MESSAGE DELIVERY PATHS                             │
└─────────────────────────────────────────────────────────────────────────┘

PRIMARY PATH (Real-time if recipient online):

Sender
  │
  ├─ POST /messages (HTTP)
  │
  └──→ Backend Handler
       │
       ├─ Save to PostgreSQL
       ├─ Emit Socket.IO: "message_received"
       │
       └──→ Recipient's Socket.IO Connection
            │
            ├─ Receive event
            ├─ Update UI
            └─ Message appears immediately

FALLBACK PATH (If recipient offline or Socket.IO fails):

Sender
  │
  ├─ POST /messages (HTTP)
  │
  └──→ Backend Handler
       │
       ├─ Save to PostgreSQL ✓ (GUARANTEED)
       ├─ Emit Socket.IO... (fails if offline)
       │
       └──→ Message stays in DB

Recipient (later):
  │
  ├─ Load chat UI
  │
  └──→ GET /messages/{sender_id}
       │
       ├─ Query PostgreSQL
       ├─ Return conversation history
       │
       └──→ Recipient sees message
            (even though they were offline)

NOTIFICATION PATH:

Sender requests booking
  │
  └──→ Backend Handler
       │
       ├─ Create Booking (PENDING_APPROVAL) ✓
       ├─ Create Notification ✓
       ├─ Emit Socket.IO: "notification_received"
       │
       └──→ Teacher's Socket.IO Connection (if online)
            │
            ├─ Receive notification event
            ├─ Show badge/toast
            └─ Notification appears immediately

Teacher (if offline):
  │
  ├─ Connect later
  │
  └──→ GET /api/v1/bookings (to fetch pending)
       │
       └─ Notification appears in pending list
          (fetched from DB)
```

---

## 7. Request/Response Cycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      HTTP REQUEST/RESPONSE CYCLE                        │
└─────────────────────────────────────────────────────────────────────────┘

CLIENT REQUEST:
┌─────────────────────────────────────────────────────┐
│ POST /api/v1/messages                              │
│ Headers:                                            │
│  - Content-Type: application/json                  │
│  - Cookie: access_token={JWT}  ← HttpOnly, auto   │
│                                                    │
│ Body:                                              │
│ {                                                  │
│   "receiver_id": "uuid",                          │
│   "content": "Hello!",                            │
│   "message_type": "TEXT"                          │
│ }                                                  │
└────────────────┬──────────────────────────────────┘
                 │
BACKEND PROCESSING:
┌────────────────▼──────────────────────────────────┐
│ 1. CookieToHeaderMiddleware                       │
│    │ Extracts access_token from cookies          │
│    └─ Sets header: x-access-token: {JWT}         │
│                                                    │
│ 2. Router matches: POST /messages                │
│                                                    │
│ 3. Dependency: get_current_user_id()             │
│    │ Reads x-access-token header                 │
│    │ Calls decode_token(token)                   │
│    └─ Returns user_id (sender)                   │
│                                                    │
│ 4. Handler: send_message()                       │
│    │ Validates request (receiver exists, etc.)   │
│    │ Calls save_and_send_message()               │
│    │ db.commit()                                 │
│    └─ Returns message object                     │
│                                                    │
│ 5. FastAPI serializes MessageResponse            │
└────────────────┬──────────────────────────────────┘
                 │
CLIENT RESPONSE:
┌────────────────▼──────────────────────────────────┐
│ 201 Created                                       │
│ {                                                 │
│   "id": "message-uuid",                          │
│   "sender_id": "sender-uuid",                    │
│   "receiver_id": "receiver-uuid",                │
│   "content": "Hello!",                           │
│   "message_type": "TEXT",                        │
│   "created_at": "2024-03-26T10:30:45.123456",   │
│   "is_read": false,                              │
│   ...                                             │
│ }                                                 │
└────────────────┬──────────────────────────────────┘
                 │
SOCKET.IO (PARALLEL, NON-BLOCKING):
┌────────────────▼──────────────────────────────────┐
│ Backend emits to receiver_uuid:                  │
│ {                                                 │
│   event: "message_received",                     │
│   data: {                                         │
│     id: "message-uuid",                          │
│     sender_id: "sender-uuid",                    │
│     content: "Hello!",                           │
│     created_at: "2024-03-26T10:30:45.123456"    │
│   }                                               │
│ }                                                 │
│                                                   │
│ Receiver's client receives and updates UI        │
└────────────────────────────────────────────────────┘

CLIENT RECEIVES BOTH:
1. HTTP 201 with message_id
2. Socket.IO event with message data

(Recipient might receive Socket.IO first or HTTP
 response first, depending on timing)
```

---

## Summary

**Key Takeaways**:

1. **Database-First**: Data persisted to PostgreSQL BEFORE Socket.IO emission
2. **HttpOnly Cookies**: Secure JWT storage, automatically sent, XSS-proof
3. **Session Tracking**: user_sessions dict maps user_id to Socket.IO session IDs
4. **Real-time + Fallback**: Socket.IO for real-time, HTTP GET for history/offline
5. **Error Safety**: Transaction rollback if anything fails before commit
6. **Multi-device**: Multiple tabs/devices tracked separately, broadcast to all

This architecture ensures **data integrity**, **security**, and **reliability**.
