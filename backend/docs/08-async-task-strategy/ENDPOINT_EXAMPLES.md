# 🔌 Stub Endpoints: Mixed BackgroundTasks + Celery

Complete endpoint stubs showing where to integrate BackgroundTasks and Celery.

---

## File 1: Auth Endpoints with BackgroundTasks

**Path**: `app/api/v1/endpoints/auth.py`

### Pattern: Token Blacklist on Logout (BackgroundTasks)

```python
from fastapi import APIRouter, BackgroundTasks, Header, Response
from app.core.dependencies import DbSession
from app.core.security import decode_token
from app.db.redis import blacklist_jti
import asyncio
import time

router = APIRouter()

def blacklist_token_sync(jti: str, ttl: int):
    """
    Background task: Add token JTI to Redis blacklist.

    Runs in thread pool (not async context).
    Simple Redis write (< 10ms).
    """
    try:
        # Run async function in thread pool
        asyncio.run(blacklist_jti(jti, ttl))
    except Exception as e:
        import logging
        logging.error(f"Failed to blacklist token {jti}: {e}")
        # Don't crash - token expires naturally anyway

@router.post("/logout")
async def logout(
    response: Response,
    background_tasks: BackgroundTasks,
    db: DbSession,
    x_refresh_token: str = Header(None, alias="x-refresh-token"),
):
    """
    Logout endpoint with immediate response.

    FLOW:
    1. Decode token and get JTI
    2. Queue background task to blacklist JTI in Redis
    3. Clear cookies
    4. Return 200 immediately

    WHY BackgroundTasks:
    ✅ Token blacklist is fast (< 10ms)
    ✅ Not critical (token expires naturally)
    ✅ User already logged out (response sent)
    ✅ No retry logic needed

    IMPLEMENTATION STATUS:
    - [x] BackgroundTasks pattern implemented
    - [x] Redis blacklist integration
    - [ ] Test in development
    - [ ] Monitor for failures
    """
    if not x_refresh_token:
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/auth")
        return {"message": "logged out"}

    try:
        # Decode token
        payload = decode_token(x_refresh_token)
        jti = payload.get("jti")
        exp = payload.get("exp")

        if jti and exp:
            # Calculate time-to-live
            ttl = int(exp) - int(time.time())
            if ttl > 0:
                # Queue background task (fires in thread pool)
                background_tasks.add_task(blacklist_token_sync, jti, ttl)
    except ValueError:
        pass  # Invalid token, ignore

    # Clear cookies
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth")

    # Return immediately (task running in background)
    return {"message": "logged out"}

# NEXT STEPS:
# 1. Test logout endpoint (should complete < 100ms)
# 2. Verify token is blacklisted in Redis
# 3. Try to use blacklisted token (should fail)
# 4. Monitor logs for blacklist errors
```

---

## File 2: Communication Endpoints with BackgroundTasks

**Path**: `app/api/v1/endpoints/communication.py` (or similar)

### Pattern: Message Notification with Socket.IO (BackgroundTasks)

```python
from fastapi import APIRouter, BackgroundTasks, Depends
from app.core.dependencies import DbSession, CurrentUser
from app.services.communication import CommunicationService
from app.core.socketio import get_socketio_manager
from uuid import UUID

router = APIRouter()

async def emit_message_socket_event(
    socketio_manager,
    receiver_id: str,
    message_data: dict,
):
    """
    Background task: Emit Socket.IO event to notify user of new message.

    This is fast (< 50ms) and fire-and-forget.
    If it fails, message is already in database (no data loss).

    Runs asynchronously in background.
    """
    try:
        await socketio_manager.emit_to_user(
            receiver_id,
            "new_message",
            message_data,
        )
    except Exception as e:
        # Log but don't crash
        # Message is already saved to DB
        import logging
        logging.warning(
            f"Failed to emit Socket.IO event to {receiver_id}: {e}"
        )

@router.post("/messages")
async def send_message(
    body: dict,  # {"receiver_id": "...", "content": "..."}
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
    socketio_manager = Depends(get_socketio_manager),
):
    """
    Send message with immediate response.

    FLOW:
    1. Save message to database
    2. Queue Socket.IO emission in background
    3. Return saved message immediately

    WHY BackgroundTasks:
    ✅ Socket.IO emission is fast (< 50ms)
    ✅ If fails, message is already in DB
    ✅ User doesn't wait for notification
    ✅ Notification is transient (no persistence needed)

    IMPLEMENTATION STATUS:
    - [x] Database save
    - [x] Background task queuing
    - [ ] Test message sending
    - [ ] Verify notification arrives in real-time
    - [ ] Monitor for Socket.IO errors
    """
    receiver_id = body.get("receiver_id")
    content = body.get("content")

    # 1. Save message to database
    message = await CommunicationService.save_and_send_message(
        db=db,
        sender_id=current_user.id,
        receiver_id=UUID(receiver_id),
        content=content,
        socketio_manager=None,  # Don't emit in main request
    )
    await db.commit()

    # 2. Prepare Socket.IO event data
    message_data = {
        "id": str(message.id),
        "sender_id": str(current_user.id),
        "content": content,
        "created_at": message.created_at.isoformat(),
    }

    # 3. Queue Socket.IO emission in background
    background_tasks.add_task(
        emit_message_socket_event,
        socketio_manager,
        receiver_id,
        message_data,
    )

    # 4. Return immediately (notification fires in background)
    return {
        "id": str(message.id),
        "status": "sent",
        "message": "Message sent and notification queued",
    }

# NEXT STEPS:
# 1. Implement send_message endpoint
# 2. Test message save to DB
# 3. Verify Socket.IO notification arrives
# 4. Monitor performance (should be < 100ms)
# 5. Test what happens if Socket.IO fails
```

### Pattern: Read Receipt Update (BackgroundTasks)

```python
from sqlalchemy import update
from app.models.communication import Message
from datetime import datetime

async def mark_message_as_read_background(db: DbSession, message_id: str):
    """
    Background task: Mark message as read and update database.

    This is fast (< 20ms) database operation.
    Fire-and-forget: no retry needed.
    """
    try:
        from uuid import UUID
        stmt = update(Message).where(
            Message.id == UUID(message_id)
        ).values(
            is_read=True,
            read_at=datetime.utcnow(),
        )
        await db.execute(stmt)
        await db.commit()
    except Exception as e:
        import logging
        logging.error(f"Failed to mark message as read: {e}")

@router.post("/messages/{message_id}/mark-read")
async def mark_message_read(
    message_id: str,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Mark message as read.

    FLOW:
    1. Return 200 immediately
    2. Queue database update in background

    WHY BackgroundTasks:
    ✅ DB update is fast (< 20ms)
    ✅ If it fails, message still exists (not critical)
    ✅ User sees local state immediately

    IMPLEMENTATION STATUS:
    - [x] BackgroundTasks pattern
    - [ ] Implement in communication endpoints
    - [ ] Emit Socket.IO "message_read" event
    - [ ] Test with multiple messages
    """
    # Queue background task
    background_tasks.add_task(mark_message_as_read_background, db, message_id)

    # Return immediately
    return {"status": "marked_as_read", "message_id": message_id}

# NEXT STEPS:
# 1. Add database read receipt update
# 2. Emit Socket.IO event to sender
# 3. Test multiple read receipts
```

---

## File 3: Payment Endpoints with Celery

**Path**: `app/api/v1/endpoints/payments.py`

### Pattern: Payment Webhook (Celery)

```python
from fastapi import APIRouter, Request
from app.tasks.payment_tasks import process_payment_webhook
import hashlib
import hmac
import json

router = APIRouter()

def validate_esewa_signature(payload: dict, signature: str) -> bool:
    """
    Validate eSewa webhook signature.

    NEXT STEPS:
    1. Get eSewa secret from config
    2. Recreate HMAC signature
    3. Compare with provided signature
    4. Use constant-time comparison for security
    """
    # TODO: Implement signature validation
    # See: https://esewa.com.np/documents/
    pass

@router.post("/webhooks/payment/esewa")
async def payment_webhook_esewa(request: Request):
    """
    Receive payment webhook from eSewa.

    FLOW:
    1. Parse request body
    2. Validate signature IMMEDIATELY (< 100ms)
    3. Queue Celery task with payload
    4. Return 200 OK to eSewa immediately
    5. Worker processes payment asynchronously

    WHY Celery:
    🔴 CRITICAL: Financial transaction (must succeed)
    ✅ RELIABLE: Auto-retry if payment verification fails
    ✅ PERSISTENT: Log all webhook events for audit
    ✅ ASYNC: Don't block webhook response (eSewa times out)

    SECURITY:
    - Validate signature before queuing
    - Don't trust webhook data without verification
    - Always verify with eSewa API

    IMPLEMENTATION STATUS:
    - [x] Celery task pattern
    - [ ] Implement signature validation
    - [ ] Queue task with correct payload
    - [ ] Test with mock webhooks
    - [ ] Verify booking status updates
    - [ ] Verify payout ledger updates
    - [ ] Test retry on failure
    - [ ] Monitor task execution in Flower
    """

    # 1. Parse request
    try:
        payload = await request.json()
    except:
        return {"error": "Invalid JSON"}, 400

    # 2. VALIDATE SIGNATURE IMMEDIATELY
    signature = request.headers.get("x-signature")
    if not signature or not validate_esewa_signature(payload, signature):
        # Return 400 to eSewa (invalid request)
        return {"error": "Invalid signature"}, 400

    # 3. Queue Celery task
    # Task will:
    # - Verify payment with eSewa API
    # - Update booking payment status
    # - Update teacher payout ledger
    # - Send user email notification
    # - Log transaction
    process_payment_webhook.delay(
        transaction_id=payload.get("transaction_id"),
        booking_id=payload.get("booking_id"),
        amount=payload.get("amount"),
        timestamp=payload.get("timestamp"),
        status=payload.get("status"),
        signature=signature,
    )

    # 4. Return 200 immediately to eSewa
    # Celery task will run independently
    return {"status": "received"}, 200

# NEXT STEPS:
# 1. Implement validate_esewa_signature()
# 2. Get eSewa webhook examples
# 3. Create test webhooks
# 4. Implement process_payment_webhook task
# 5. Test with mock data
# 6. Verify booking status updates
# 7. Verify payout ledger updates
# 8. Test Celery retry on failure
```

---

## File 4: Booking Endpoints with Celery

**Path**: `app/api/v1/endpoints/bookings.py`

### Pattern: Send Email on Booking Creation (Celery)

```python
from fastapi import APIRouter
from app.tasks.notification_tasks import send_booking_confirmation_email
from app.models.booking import Booking

router = APIRouter()

@router.post("/bookings")
async def create_booking(
    body: dict,  # BookingCreate schema
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Create booking and queue confirmation emails.

    FLOW:
    1. Create booking in database
    2. Queue Celery task to send email to student
    3. Queue Celery task to send email to teacher
    4. Return booking details immediately

    WHY Celery:
    ✅ Email is SLOW (1-5 seconds per email)
    ✅ Don't block user's request
    ✅ If email fails, Celery auto-retries
    ✅ Can monitor email delivery with Flower

    IMPLEMENTATION STATUS:
    - [x] Celery task pattern
    - [ ] Implement booking creation
    - [ ] Queue confirmation email to student
    - [ ] Queue notification email to teacher
    - [ ] Test end-to-end
    - [ ] Verify emails arrive
    - [ ] Monitor task failures in Flower
    """

    # 1. Create booking
    booking = Booking(
        student_id=current_user.id,
        teacher_id=body.get("teacher_id"),
        subject_id=body.get("subject_id"),
        status="PENDING",
    )
    db.add(booking)
    await db.commit()

    # 2. Queue email to student
    send_booking_confirmation_email.delay(
        user_email=current_user.email,
        booking_id=str(booking.id),
        user_name=current_user.first_name,
    )

    # 3. Queue email to teacher
    # get_teacher_email function stub:
    # teacher_email = await get_teacher_email(body.get("teacher_id"))
    # send_teacher_booking_notification_email.delay(
    #     teacher_email=teacher_email,
    #     booking_id=str(booking.id),
    # )

    # 4. Return immediately (emails queue in background)
    return {
        "booking_id": str(booking.id),
        "status": "created",
        "message": "Booking created. Confirmation emails queued.",
    }

# NEXT STEPS:
# 1. Implement booking creation logic
# 2. Create email templates
# 3. Implement send_booking_confirmation_email task
# 4. Test email delivery
# 5. Verify teacher notification
# 6. Monitor Celery task execution
```

---

## File 5: Session Endpoints with Celery

**Path**: `app/api/v1/endpoints/sessions.py`

### Pattern: Scheduled Session Reminders (Celery Beat)

```python
from fastapi import APIRouter
from app.tasks.notification_tasks import send_session_reminder_email

router = APIRouter()

@router.post("/sessions/{session_id}/initiate")
async def initiate_session(
    session_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Initiate session and queue reminder emails.

    FLOW:
    1. Update session status to INITIATED
    2. Queue reminder email to student (send now)
    3. Queue reminder email to teacher (send now)
    4. Beat scheduler will queue reminders 10 min before session (automatic)
    5. Return session details immediately

    WHY Celery:
    ✅ Email is SLOW
    ✅ Beat scheduler handles 10-min reminders automatically
    ✅ Reliable (survives server restart)
    ✅ Can be monitored with Flower

    BEAT SCHEDULE:
    See app/workers/celery_config.py for:
    - send_session_reminders (every 30 min)
    - check_session_no_shows (every 5 min)

    IMPLEMENTATION STATUS:
    - [x] Celery task pattern
    - [x] Beat schedule in celery_config.py
    - [ ] Implement session initiation
    - [ ] Queue immediate reminder emails
    - [ ] Test Beat scheduler
    - [ ] Verify reminders arrive 10 min before
    - [ ] Monitor no-show detection
    """

    # 1. Update session status
    session = await get_session_by_id(session_id)
    session.status = "INITIATED"
    session.started_at = datetime.utcnow()
    await db.flush()

    # 2. Queue immediate reminder emails
    send_session_reminder_email.delay(
        session_id=session_id,
        send_to="both",  # Both student and teacher
    )

    # 3. Beat scheduler will auto-queue reminders
    # See: app/workers/celery_config.py
    # Schedule: Every 30 minutes, send reminders for upcoming sessions

    # 4. Return immediately
    return {
        "session_id": session_id,
        "status": "initiated",
        "message": "Session initiated. Reminders queued.",
    }

# NEXT STEPS:
# 1. Implement session initiation logic
# 2. Get LiveKit token from session
# 3. Create reminder email templates
# 4. Test immediate reminder emails
# 5. Verify Beat scheduler sends reminders
# 6. Test 10-min pre-session reminders
# 7. Monitor for failed email delivery
```

---

## Summary: Which Pattern to Use

### BackgroundTasks (Simple & Fast)

```python
# Use for quick operations (< 100ms)
background_tasks.add_task(blacklist_token, jti, ttl)
background_tasks.add_task(emit_socket_event, user_id, data)
background_tasks.add_task(save_notification, user_id, msg)

# No retry logic
# No persistence
# Fire and forget
```

### Celery (Reliable & Scheduled)

```python
# Use for critical/long operations
process_payment_webhook.delay(transaction_id, amount)
send_booking_confirmation_email.delay(email, booking_id)
process_weekly_payouts.delay()  # Scheduled by Beat

# Auto-retry on failure
# Persisted in Redis queue
# Can monitor with Flower
```

---

## ✅ Implementation Roadmap

### Phase 1: BackgroundTasks (Week 1)

- [ ] Logout token blacklist
- [ ] Message notifications (Socket.IO)
- [ ] Read receipts
- [ ] Simple notifications

### Phase 2: Celery - Payments (Week 2)

- [ ] Payment webhook processing
- [ ] Weekly payout scheduler
- [ ] Payout email notifications

### Phase 3: Celery - Other (Week 3)

- [ ] Booking confirmation emails
- [ ] Session reminder emails
- [ ] Session recording summaries
- [ ] Cleanup scheduled tasks

### Phase 4: Monitoring (Week 4)

- [ ] Deploy Flower
- [ ] Monitor task failures
- [ ] Set up alerts

---

**Next**: Implement Phase 1 endpoints this week!
