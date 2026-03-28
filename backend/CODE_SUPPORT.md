# LiveKit Integration Support Guide

This document is focused on LiveKit and how it is wired into the current GuruBhet backend.

Verified against current code on March 27, 2026.

## 1. What This Covers

Use this guide when debugging or extending:

- LiveKit room creation and teardown
- LiveKit token issuance
- Session lifecycle transitions tied to LiveKit events
- Webhook processing from LiveKit
- Redis-backed handshake and room state used by session flows
- Socket.IO notifications that coordinate teacher and student clients

## 2. LiveKit Integration Map (Current Files)

Core wiring and config:

- app/main.py
  - Calls init_livekit() on startup and close_livekit() on shutdown
  - Mounts FastAPI and Socket.IO app together
- app/core/config.py
  - LIVEKIT_API_KEY
  - LIVEKIT_API_SECRET
  - LIVEKIT_URL

LiveKit utility layer:

- app/utils/livekit.py
  - init_livekit(), close_livekit(), get_livekit_api()
  - generate_room_token()
  - create_room(), end_room()
  - set_pending_session_key(), get_pending_session_key(), clear_pending_session_key()

HTTP endpoints involved in LiveKit lifecycle:

- app/api/v1/endpoints/bookings.py
  - request-session handshake and student acceptance flow
  - room creation during acceptance
  - token issuance endpoint at booking/session scope
  - reconnect sync endpoint
- app/api/v1/endpoints/sessions.py
  - session-level join endpoint
  - room creation on first join
  - teacher complete endpoint with room teardown
- app/api/v1/endpoints/livekit.py
  - signed webhook receiver and event processing

Data model and schema:

- app/models/booking.py
  - Session.livekit_room_name
  - session timestamps used by join and webhook updates
- app/schemas/booking.py
  - LiveKitTokenResponse
  - SessionReadWithToken

Realtime and presence support:

- app/core/socketio.py
- app/api/v1/socketio_handlers.py
- app/utils/presence.py
- app/db/redis.py

## 3. Runtime Lifecycle (End To End)

### 3.1 Startup

1. app starts.
2. app/main.py lifespan calls init_livekit().
3. app/utils/livekit.py creates a singleton LiveKitAPI client.

### 3.2 Teacher Requests Session (Handshake Window)

Endpoint:

- POST /api/v1/bookings/{booking_id}/request-session

Flow in bookings endpoint:

1. Verifies teacher role and booking ownership.
2. Requires booking status ACTIVE.
3. Checks student online presence via Redis-backed presence utility.
4. Creates a session request message.
5. Sets a 60-second pending handshake key for request window.
6. Emits Socket.IO session_request event to student.

### 3.3 Student Accepts And Room Is Created

Endpoint:

- POST /api/v1/bookings/{booking_id}/sessions/{session_id}/accept

Flow:

1. Verifies student role and booking ownership.
2. Validates pending acceptance window via Redis key check.
3. Creates Session row in DB.
4. Creates LiveKit room if missing using create_room().
5. Stores room name in Session.livekit_room_name.
6. Caches session room state in Redis.
7. Clears pending handshake key.
8. Generates teacher token and emits session_ready via Socket.IO.
9. Returns student token in HTTP response.

### 3.4 Participant Joins LiveKit

Session-scoped join endpoint:

- POST /api/v1/sessions/{session_id}/join

Booking-scoped token endpoint:

- GET /api/v1/bookings/{booking_id}/sessions/{session_id}/livekit-token

Both flows generate LiveKit tokens and record join timestamps. On first join, session is moved to IN_PROGRESS and actual_start_at is set.

### 3.5 Sync After Refresh Or Reconnect

Endpoint:

- GET /api/v1/bookings/{booking_id}/sync

Flow:

1. Finds SCHEDULED or IN_PROGRESS session.
2. Validates session window with leniency rule.
3. Records join timestamp if missing.
4. Returns a fresh LiveKit token.

Leniency rule implemented:

- leniency_minutes = session_duration_minutes // 15

### 3.6 Session Completion And Room Teardown

Endpoint:

- POST /api/v1/sessions/{session_id}/complete

Flow:

1. Teacher-only action.
2. Session transitions IN_PROGRESS -> COMPLETED.
3. duration_seconds is calculated from actual_start_at.
4. Booking counters are updated.
5. SESSION_RELEASE transaction is created.
6. LiveKit room is deleted via end_room().
7. Redis session keys are cleared.
8. Socket.IO session_completed event is emitted.
9. Post-session Celery tasks are queued.

### 3.7 LiveKit Webhook Reconciliation

Endpoint:

- POST /api/v1/livekit/webhook

Signature verification:

- Uses WebhookReceiver + TokenVerifier with LIVEKIT_API_KEY and LIVEKIT_API_SECRET.

Handled events:

- room_started
  - If session is SCHEDULED: set IN_PROGRESS and actual_start_at.
- room_finished
  - If session is IN_PROGRESS: set COMPLETED and actual_end_at.
  - Increment booking.completed_sessions and possibly mark booking COMPLETED.
  - Increment teacher-subject completed counter.
- participant_joined
  - Sets teacher_joined_at or student_joined_at from participant identity user-{uuid}.
- participant_left
  - If other party never joined, marks no-show cancellation status.

## 4. Naming Conventions And Token Claims

From app/utils/livekit.py:

- Room name: session-{session_id}
- Participant identity: user-{user_id}
- Token grants include:
  - room_join
  - can_publish
  - can_subscribe
  - can_publish_data
  - can_update_own_metadata
- Metadata includes:
  - is_teacher

## 5. Session And Booking Statuses Relevant To LiveKit

From app/core/enums.py:

SessionStatus used in LiveKit path:

- PENDING_STUDENT_ACCEPTANCE
- SCHEDULED
- IN_PROGRESS
- COMPLETED
- CANCELLED_BY_STUDENT
- CANCELLED_BY_TEACHER

BookingStatus checks used in join/token flows:

- ACTIVE required for joining/token issuance
- COMPLETED set when all sessions are complete

## 6. Redis Keys Used By LiveKit-Adjacent Flows

Used for handshake, room state, and presence:

- pending_session_request:{booking_id}
  - Set by presence utility in teacher request-session flow
- pending_session:{booking_id}
  - Checked and cleared by livekit utility in student accept/complete flows
- session_room_state:{session_id}
  - Cached room state for sync/recovery logic
- user_online:{user_id}
  - Presence tracking for online checks

When debugging acceptance failures, verify both pending key patterns because both are currently present in integration paths.

## 7. Socket.IO Events Related To LiveKit Session Coordination

Current events emitted in session coordination paths include:

- session_request
  - teacher -> student request notification
- session_ready
  - student acceptance -> teacher receives token and room info
- session_completed
  - broadcast at completion

Socket session auth and user room mapping:

- Users join private room user_{user_id} during socket connect.
- Event delivery to user uses SocketIOManager.emit_to_user().

## 8. Quick Troubleshooting Playbook

If token generation fails:

1. Check LIVEKIT_API_KEY and LIVEKIT_API_SECRET values.
2. Confirm room/session IDs are valid and user is booking participant.
3. Confirm booking is ACTIVE and session status is joinable.

If room creation fails:

1. Confirm init_livekit() ran (startup path).
2. Confirm LiveKit server URL is reachable from backend.
3. Check create_room() call site and current session status.

If webhook updates do not apply:

1. Verify webhook signature header is passed correctly.
2. Confirm room name follows session-{session_id} format.
3. Confirm Session.livekit_room_name matches webhook room name.

If student acceptance expires unexpectedly:

1. Inspect pending_session_request and pending_session keys in Redis.
2. Verify TTL and timing around request-session and accept endpoints.
3. Check whether background expiration handlers cleared keys.

## 9. Recommended Read Order For LiveKit Work

1. app/main.py
2. app/core/config.py
3. app/utils/livekit.py
4. app/models/booking.py
5. app/schemas/booking.py
6. app/api/v1/endpoints/bookings.py
7. app/api/v1/endpoints/sessions.py
8. app/api/v1/endpoints/livekit.py
9. app/core/socketio.py
10. app/api/v1/socketio_handlers.py
11. app/utils/presence.py
12. app/db/redis.py

## 10. Notes For Future Refactoring

Potential simplification opportunity:

- Consolidate pending handshake Redis usage to one key namespace and one helper module to reduce acceptance-edge-case complexity.
