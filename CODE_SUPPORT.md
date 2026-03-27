# 🎬 LiveKit Code Files - Reading Order & Understanding Guide

This guide shows you all the code files involved in LiveKit integration and in what order to read them to understand the complete implementation.

---

## 📊 Overview: LiveKit Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Socket.IO Client)              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│          FastAPI Backend + Socket.IO Server                 │
├─────────────────────────────────────────────────────────────┤
│  Core Components:                                           │
│  • Authentication & JWT Tokens                              │
│  • Session Management & State                               │
│  • Real-time Communication (Socket.IO)                      │
│  • LiveKit Token Generation                                 │
└────────┬──────────────────────────────┬──────────────────────┘
         │                              │
         ↓                              ↓
    ┌─────────┐              ┌──────────────────┐
    │ Database│              │  LiveKit Server  │
    │(Session │              │  (Video/Audio)   │
    │ State)  │              │                  │
    └─────────┘              └──────────────────┘
```

---

## 🎯 Phase 1: Foundation & Configuration (15 minutes)

Start here to understand the basic setup and configuration.

### 1.1 **`backend/app/core/config.py`**

**What:** Environment configuration and LiveKit settings  
**Size:** ~150 lines  
**Key Content:**

- LiveKit URL and API key/secret
- JWT configuration
- Token expiration times
- API base URLs

**What to look for:**

```python
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
```

---

### 1.2 **`backend/app/core/security.py`**

**What:** JWT token creation and validation  
**Size:** ~200 lines  
**Key Content:**

- JWT encoding/decoding functions
- Password hashing
- Token creation for users
- Token validation

**Key Functions:**

- `create_access_token()` - Creates JWT tokens
- `verify_token()` - Validates JWT tokens
- `get_current_user()` - Dependency for protected endpoints

**Why it matters:** LiveKit tokens are JWTs created using similar patterns

---

## 🎯 Phase 2: Database Models (20 minutes)

Understand the data structures that store session and booking information.

### 2.1 **`backend/app/models/booking.py`**

**What:** Session request and booking models  
**Size:** ~300 lines  
**Key Content:**

- SessionRequest model (status, timestamps, participants)
- Booking model (session details, payment info)
- Relationships between users, sessions, and bookings

**Key Fields to understand:**

```python
class SessionRequest(Base):
    id: Integer
    status: Enum (pending, approved, in_progress, completed, cancelled)
    teacher_id: Foreign Key
    student_id: Foreign Key
    scheduled_time: DateTime
    duration: Integer
    room_name: String  # LiveKit room identifier

class Booking(Base):
    session_request_id: Foreign Key
    payment_status: Enum
    amount: Float
    # ... payment related fields
```

---

### 2.2 **`backend/app/models/teacher.py`** and **`backend/app/models/student.py`**

**What:** User models for teachers and students  
**Size:** ~150 lines each  
**Key Content:**

- User profile information
- Presence status
- Session history relationships

---

## 🎯 Phase 3: Schemas & API Contracts (15 minutes)

Understand the data structures sent to/from the API.

### 3.1 **`backend/app/schemas/booking.py`**

**What:** Request/response schemas for booking operations  
**Key Schemas:**

- `BookingCreate` - Create booking request
- `BookingResponse` - Booking details response
- `SessionRequestSchema` - Session request data

**Why important:** Defines API contracts for session creation

---

### 3.2 **`backend/app/schemas/user.py`**

**What:** User request/response schemas  
**Key Content:**

- User profile schemas
- Presence status schemas

---

## 🎯 Phase 4: Core LiveKit Utilities (30 minutes)

The heart of LiveKit integration - token generation and room management.

### 4.1 **`backend/app/utils/livekit.py`** ⭐ MOST IMPORTANT

**What:** LiveKit SDK wrapper and utilities  
**Size:** ~400-500 lines  
**Key Content:**

- LiveKit client initialization
- Access token generation (`generate_access_token()`)
- Room management (create, delete, list participants)
- Webhook handling
- Error handling specific to LiveKit

**Key Functions to understand:**

```python
def generate_access_token(
    user_id: str,
    username: str,
    room_name: str,
    permissions: VideoGrants
) -> str:
    """Generate LiveKit access token"""

def get_room_info(room_name: str):
    """Get current participants and room status"""

def delete_room(room_name: str):
    """Close room and disconnect participants"""

def handle_webhook_event(event_data: dict):
    """Process LiveKit webhook events"""
```

**Read this file line-by-line** - it's the bridge between your app and LiveKit

---

### 4.2 **`backend/app/utils/storage.py`**

**What:** File upload/storage utilities  
**Size:** ~200 lines  
**Key Content:**

- S3/cloud storage integration
- Recording upload handling
- Session media management

**Why important:** Session recordings are stored via this utility

---

## 🎯 Phase 5: Real-time Communication (45 minutes)

Socket.IO integration for real-time events and session state synchronization.

### 5.1 **`backend/app/core/socketio.py`**

**What:** Socket.IO server initialization  
**Size:** ~100 lines  
**Key Content:**

```python
sio = AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    # ... other config
)
```

**What it does:**

- Creates the Socket.IO server instance
- Configures CORS and authentication
- Sets up async handling

---

### 5.2 **`backend/app/core/socketio_middleware.py`**

**What:** Authentication middleware for Socket.IO connections  
**Size:** ~150 lines  
**Key Content:**

- Socket.IO authentication handler
- JWT token validation for connections
- User association with socket connections

**Key Function:**

```python
@sio.event
async def connect(sid, environ):
    """Authenticate socket connection"""
    # Extract JWT from query params
    # Verify token
    # Associate user with socket session
```

---

### 5.3 **`backend/app/services/communication.py`** ⭐ IMPORTANT

**What:** High-level communication service  
**Size:** ~300-400 lines  
**Key Content:**

- Broadcasting session state updates
- Emitting LiveKit room events
- Handling participant join/leave
- Updating session status via WebSocket

**Key Functions:**

```python
async def emit_session_started(room_name: str, participants: List):
    """Notify all clients that session started"""

async def emit_participant_joined(room_name: str, participant: dict):
    """Notify when someone joins the video room"""

async def emit_session_ended(room_name: str, recording_url: str):
    """Notify when session ends and recording URL"""
```

---

### 5.4 **`backend/app/middleware/cookie_to_header.py`**

**What:** Middleware to convert cookies to headers for Socket.IO  
**Size:** ~50 lines  
**Key Content:**

- Converts authentication cookies to headers
- Ensures Socket.IO auth headers are properly passed

---

## 🎯 Phase 6: API Endpoints & Repositories (45 minutes)

The API layer that orchestrates everything.

### 6.1 **`backend/app/api/v1/endpoints/bookings.py`** or **`backend/app/api/v1/endpoints/sessions.py`**

**What:** API endpoints for session operations  
**Size:** ~400-600 lines  
**Key Endpoints:**

```python
POST /api/v1/sessions/request       # Create session request
GET /api/v1/sessions/{id}           # Get session details
POST /api/v1/sessions/{id}/approve  # Approve session
POST /api/v1/sessions/{id}/join     # Join video room
POST /api/v1/sessions/{id}/end      # End session
GET /api/v1/sessions/{id}/token     # Get LiveKit token
```

**What each endpoint does:**

1. **Create request** - Creates booking, reserves slot
2. **Approve** - Validates, creates LiveKit room
3. **Get token** - Generates access token for frontend
4. **Join** - Records participant join, updates status
5. **End** - Closes room, triggers recording upload, payment

**Key code pattern:**

```python
@router.post("/sessions/{session_id}/token")
async def get_session_token(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify user is part of session
    # 2. Generate LiveKit token
    # 3. Return token to client
```

---

### 6.2 **`backend/app/repositories/user_repo.py`** and **`backend/app/repositories/session_repo.py`**

**What:** Database access layer (Repository Pattern)  
**Size:** ~200-300 lines each  
**Key Content:**

- User queries
- Session queries
- Teacher availability queries

**Why important:** Encapsulates database access, used by services

---

### 6.3 **`backend/app/repositories/base.py`**

**What:** Base repository with common CRUD operations  
**Size:** ~100 lines  
**Key Functions:**

- `get_by_id()`
- `create()`
- `update()`
- `delete()`

---

## 🎯 Phase 7: Task Queue & Background Jobs (30 minutes)

Async operations that happen after session events.

### 7.1 **`backend/app/workers/celery_app.py`**

**What:** Celery application configuration  
**Size:** ~50 lines  
**Key Content:**

```python
app = Celery(
    'guru_bhet',
    broker=REDIS_URL,
    backend=REDIS_URL,
)
```

---

### 7.2 **`backend/app/tasks/session_request_tasks.py`**

**What:** Session-related background tasks  
**Size:** ~200-300 lines  
**Key Tasks:**

```python
@app.task
def process_session_start(session_id: str):
    """Handle session start - update DB, notify users"""

@app.task
def cleanup_session_room(room_name: str):
    """Delete room after session ends"""

@app.task
def process_recording(room_name: str, recording_url: str):
    """Handle recording upload and storage"""
```

**Why important:** These run after session events (join, end, etc.)

---

### 7.3 **`backend/app/tasks/notification_tasks.py`**

**What:** Send notifications for session events  
**Size:** ~150 lines  
**Key Tasks:**

- Send session approval notifications
- Send session reminder notifications
- Send session completed notifications

---

### 7.4 **`backend/app/tasks/payment_tasks.py`** and **`backend/app/tasks/payout_tasks.py`**

**What:** Payment and payout processing  
**Size:** ~250 lines each  
**Key Content:**

- Process payment after session
- Calculate and process teacher payouts

---

## 🎯 Phase 8: Database Configuration & ORM (20 minutes)

How the database connections work.

### 8.1 **`backend/app/db/session.py`**

**What:** Database session management  
**Size:** ~50-100 lines  
**Key Content:**

```python
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

def get_db():
    """Dependency for database session"""
```

---

### 8.2 **`backend/app/db/base.py`**

**What:** SQLAlchemy base model  
**Size:** ~20 lines  
**Key Content:**

```python
Base = declarative_base()
```

---

### 8.3 **`backend/app/db/redis.py`**

**What:** Redis connection and utilities  
**Size:** ~100 lines  
**Key Content:**

- Redis client initialization
- Cache operations
- Session state caching

**Why important:** Stores temporary session state and presence info

---

## 🎯 Phase 9: Main Application & Dependencies (15 minutes)

How it all comes together.

### 9.1 **`backend/app/core/dependencies.py`**

**What:** FastAPI dependency injection functions  
**Size:** ~100-150 lines  
**Key Functions:**

```python
async def get_current_user() -> User:
    """Get current authenticated user"""

async def get_db() -> Generator:
    """Get database session"""

async def verify_session_access() -> bool:
    """Verify user can access this session"""
```

---

### 9.2 **`backend/app/main.py`** ⭐ START/END POINT

**What:** Application entry point  
**Size:** ~150-200 lines  
**Key Content:**

- FastAPI app initialization
- Socket.IO mounting
- Middleware registration
- Route inclusion
- Startup/shutdown events

**Key pattern:**

```python
app = FastAPI()
sio = AsyncServer(...)
app = ASGIApp(sio, app)

@app.on_event("startup")
async def startup():
    # Initialize connections

@app.on_event("shutdown")
async def shutdown():
    # Cleanup connections
```

---

## 📚 Complete Reading Order Summary

### **Quick Path (2-3 hours)**

If you want to understand LiveKit quickly:

1. `backend/app/core/config.py` - 5 min
2. `backend/app/utils/livekit.py` - 30 min ⭐ Most important
3. `backend/app/api/v1/endpoints/bookings.py` - 30 min
4. `backend/app/services/communication.py` - 20 min
5. `backend/app/models/booking.py` - 15 min
6. `backend/docs/LIVEKIT_UNDERSTAND.md` - 30 min (reference)

### **Complete Path (4-5 hours)**

Full understanding of all components:

1. Phase 1: Configuration (15 min)
2. Phase 2: Database Models (20 min)
3. Phase 3: Schemas (15 min)
4. Phase 4: LiveKit Utils (30 min) ⭐
5. Phase 5: Real-time Communication (45 min)
6. Phase 6: API Endpoints (45 min)
7. Phase 7: Background Tasks (30 min)
8. Phase 8: Database (20 min)
9. Phase 9: Main App (15 min)

### **Developer Path (Implementation)**

If you need to implement a feature:

1. `backend/app/utils/livekit.py` - Understand token generation
2. `backend/app/api/v1/endpoints/bookings.py` - See endpoint patterns
3. `backend/app/services/communication.py` - Emit events
4. `backend/app/tasks/session_request_tasks.py` - Background jobs
5. `backend/docs/LIVEKIT_UNDERSTAND.md` - Architecture reference

---

## 🗂️ File Dependency Map

```
backend/app/main.py (Entry Point)
├── backend/app/core/config.py
│   └── Environment & LiveKit credentials
│
├── backend/app/core/socketio.py
│   └── backend/app/core/socketio_middleware.py
│       └── backend/app/core/security.py
│
├── backend/app/api/v1/endpoints/bookings.py ⭐
│   ├── backend/app/models/booking.py
│   ├── backend/app/models/session_request.py
│   ├── backend/app/utils/livekit.py ⭐⭐⭐
│   │   └── backend/app/core/config.py
│   ├── backend/app/services/communication.py
│   │   └── backend/app/core/socketio.py
│   ├── backend/app/tasks/session_request_tasks.py
│   └── backend/app/repositories/user_repo.py
│
├── backend/app/core/dependencies.py
│   └── backend/app/db/session.py
│
└── backend/app/workers/celery_app.py
    └── backend/app/tasks/ (all task files)
```

---

## 🔑 Key Files to Focus On

| Importance  | File                                         | Why                               |
| ----------- | -------------------------------------------- | --------------------------------- |
| 🔴 Critical | `backend/app/utils/livekit.py`               | Token generation, room management |
| 🔴 Critical | `backend/app/api/v1/endpoints/bookings.py`   | API endpoints, orchestration      |
| 🟠 High     | `backend/app/services/communication.py`      | Real-time updates                 |
| 🟠 High     | `backend/app/core/security.py`               | JWT tokens                        |
| 🟠 High     | `backend/app/models/booking.py`              | Session data model                |
| 🟡 Medium   | `backend/app/tasks/session_request_tasks.py` | Background jobs                   |
| 🟡 Medium   | `backend/app/core/socketio.py`               | WebSocket server                  |
| 🟢 Low      | `backend/app/db/redis.py`                    | Caching layer                     |

---

## 💡 Tips for Reading Code

1. **Start with `backend/app/utils/livekit.py`** - This is THE file for LiveKit
2. **Then read `backend/app/api/v1/endpoints/bookings.py`** - See how livekit.py is used
3. **Then `backend/app/services/communication.py`** - See real-time updates
4. **Use `backend/docs/LIVEKIT_UNDERSTAND.md`** - As reference while reading code
5. **Cross-reference with models** - Understand data structures
6. **Follow the flow** - From endpoint → service → task → database

---

## 🚀 Next Steps

After reading all these files:

1. Run the application locally
2. Trace a complete session flow in the debugger
3. Look at actual WebSocket messages in browser DevTools
4. Try to modify a feature (e.g., add a new event emission)
5. Refer back to code when implementing new features

---

**Generated:** March 27, 2026  
**Related Documentation:** See `backend/docs/LIVEKIT_UNDERSTAND.md` for architecture and design decisions
