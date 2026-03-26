# 🛠️ Async Task Patterns: Code Examples

Complete working patterns for both BackgroundTasks and Celery.

---

## Part 1: BackgroundTasks Patterns

### Pattern 1.1: Simple Redis Operation (Token Blacklist)

```python
from fastapi import APIRouter, BackgroundTasks
from app.core.dependencies import DbSession, CurrentUser
from app.core.security import decode_token
from app.db.redis import blacklist_jti
import asyncio
from uuid import UUID

router = APIRouter()

def blacklist_token_sync(jti: str, ttl: int):
    """
    Background task: Add token JTI to Redis blacklist.

    Runs in thread pool (not async context).
    This is a simple operation that completes in < 10ms.
    """
    try:
        asyncio.run(blacklist_jti(jti, ttl))
    except Exception as e:
        # Log error but don't crash (fire-and-forget)
        import logging
        logging.error(f"Failed to blacklist token {jti}: {e}")

@router.post("/logout")
async def logout(
    response: Response,
    background_tasks: BackgroundTasks,
    db: DbSession,
    x_refresh_token: str = Header(None, alias="x-refresh-token"),
):
    """
    Logout endpoint with immediate response.

    PATTERN:
    1. Decode token and get JTI
    2. Queue background task to blacklist JTI
    3. Clear cookies
    4. Return 200 immediately

    WHY BackgroundTasks:
    - Token blacklist is fast (Redis write < 10ms)
    - Not critical (token expires naturally after 7 days)
    - User already logged out (response already sent)
    - No retry needed
    """
    if not x_refresh_token:
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/auth")
        return {"message": "logged out"}

    try:
        payload = decode_token(x_refresh_token)
        jti = payload.get("jti")
        exp = payload.get("exp")

        if jti and exp:
            # Queue task (fires in background)
            ttl = int(exp) - int(time.time())
            background_tasks.add_task(blacklist_token_sync, jti, ttl)
    except ValueError:
        pass  # Invalid token, ignore

    # Clear cookies
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth")

    # Return immediately (task running in background)
    return {"message": "logged out"}
```

### Pattern 1.2: Socket.IO Event (Message Notification)

```python
from fastapi import APIRouter, BackgroundTasks
from app.models.communication import Message
from app.services.communication import CommunicationService

router = APIRouter()

async def emit_message_event(socketio_manager, receiver_id: str, message_data: dict):
    """
    Background task: Emit Socket.IO event to notify user of new message.

    Runs async but doesn't block the API response.
    This is fast (< 50ms) and fire-and-forget (no retry needed).
    """
    try:
        await socketio_manager.emit_to_user(
            receiver_id,
            "new_message",
            message_data,
        )
    except Exception as e:
        # Log but don't crash (notification already in DB)
        import logging
        logging.warning(f"Failed to emit Socket.IO event to {receiver_id}: {e}")

@router.post("/messages")
async def send_message(
    body: MessageCreate,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
    socketio_manager = Depends(get_socketio_manager),
):
    """
    Send message with immediate response.

    PATTERN:
    1. Save message to database
    2. Queue Socket.IO emission in background
    3. Return saved message immediately

    WHY BackgroundTasks:
    - Socket.IO emission is fast (< 50ms)
    - If fails, message is already in DB (user can refresh)
    - No persistence needed (event is transient)
    - No retry logic needed
    """
    # 1. Save message to DB
    message = await CommunicationService.save_and_send_message(
        db=db,
        sender_id=current_user.id,
        receiver_id=body.receiver_id,
        content=body.content,
        socketio_manager=None,  # Don't emit here
    )
    await db.commit()

    # 2. Queue Socket.IO emission in background
    message_data = {
        "id": str(message.id),
        "sender_id": str(current_user.id),
        "content": body.content,
        "created_at": message.created_at.isoformat(),
    }
    background_tasks.add_task(
        emit_message_event,
        socketio_manager,
        str(body.receiver_id),
        message_data,
    )

    # 3. Return immediately
    return {"message": message, "status": "sent"}
```

### Pattern 1.3: Database Update (Read Receipt)

```python
from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import update
from app.models.communication import Message

router = APIRouter()

async def mark_as_read_background(db_session, message_id: str):
    """
    Background task: Mark message as read and emit event.

    This is fast (< 20ms) database operation.
    Fire-and-forget: no retry needed.
    """
    try:
        stmt = update(Message).where(
            Message.id == UUID(message_id)
        ).values(
            is_read=True,
            read_at=datetime.utcnow(),
        )
        await db_session.execute(stmt)
        await db_session.commit()
    except Exception as e:
        import logging
        logging.error(f"Failed to mark message as read: {e}")

@router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Mark message as read.

    PATTERN:
    1. Return 200 immediately
    2. Queue read status update in background

    WHY BackgroundTasks:
    - DB update is fast (< 20ms)
    - If it fails, not critical (message still viewable)
    - User sees local state immediately
    """
    # Queue background task
    background_tasks.add_task(mark_as_read_background, db, message_id)

    # Return immediately
    return {"status": "marked_as_read"}
```

---

## Part 2: Celery Patterns

### Pattern 2.1: Webhook Processing (Critical)

```python
from fastapi import APIRouter, Request
from app.tasks.payment_tasks import process_payment_webhook

router = APIRouter()

@router.post("/webhooks/payment")
async def payment_webhook(request: Request):
    """
    Receive payment webhook from eSewa.

    PATTERN:
    1. Read and validate signature IMMEDIATELY (< 100ms)
    2. Queue Celery task with payload
    3. Return 200 OK to eSewa immediately
    4. Worker processes payment asynchronously

    WHY Celery:
    - CRITICAL: Financial transaction (must succeed)
    - MUST be RELIABLE: If server crashes, webhook will be retried by eSewa
    - MUST PERSIST: Log all webhook events for audit
    - MUST NOTIFY: Update booking status, send user email

    NEXT STEPS:
    1. Create app/tasks/payment_tasks.py with process_payment_webhook
    2. Implement signature validation (eSewa docs)
    3. Implement payment_webhook task with:
       - Verify transaction with eSewa API
       - Update booking payment status
       - Update teacher payout ledger
       - Send user email notification
       - Log transaction
    """

    # 1. Parse webhook
    payload = await request.json()

    # 2. VALIDATE SIGNATURE IMMEDIATELY
    if not validate_esewa_signature(payload):
        # Don't queue invalid payload
        return {"status": "error", "message": "Invalid signature"}, 400

    # 3. Queue Celery task (runs in background worker)
    process_payment_webhook.delay(
        transaction_id=payload.get("transaction_id"),
        booking_id=payload.get("booking_id"),
        amount=payload.get("amount"),
        timestamp=payload.get("timestamp"),
        status=payload.get("status"),
    )

    # 4. Return 200 immediately to eSewa
    # Task will run in Celery worker independently
    return {"status": "received"}, 200

def validate_esewa_signature(payload: dict) -> bool:
    """
    Validate eSewa webhook signature.

    NEXT STEPS:
    1. Get eSewa signature from payload header
    2. Recreate signature using payload + secret key
    3. Compare (constant-time comparison for security)

    See: app/tasks/payment_tasks.py (process_payment_webhook)
    """
    # TODO: Implement signature validation
    pass
```

### Pattern 2.2: Async Email Task (Non-Critical)

```python
from celery import shared_task
from app.tasks.notification_tasks import send_email_task
from fastapi import APIRouter

router = APIRouter()

@shared_task(
    name="app.tasks.notification_tasks.send_booking_confirmation_email",
    bind=True,
    max_retries=3,  # Retry up to 3 times
)
def send_booking_confirmation_email(self, user_email: str, booking_id: str):
    """
    Send booking confirmation email.

    This task runs in Celery worker, not in request thread.

    FEATURES:
    - Auto-retry 3 times on failure
    - Logs to file with timestamps
    - Can be monitored with Flower
    - Survives server restart
    """
    try:
        # 1. Fetch booking details from DB
        booking = get_booking_by_id(booking_id)
        if not booking:
            raise Exception(f"Booking {booking_id} not found")

        # 2. Render email template
        email_body = render_booking_confirmation_template(booking)

        # 3. Send email
        send_email(
            to=user_email,
            subject="Booking Confirmed",
            body=email_body,
        )

        return {"status": "sent", "booking_id": booking_id}

    except Exception as exc:
        # Auto-retry with exponential backoff
        # First retry: 60 sec, Second: 120 sec, Third: 180 sec
        raise self.retry(exc=exc, countdown=60)

@router.post("/bookings")
async def create_booking(body: BookingCreate, current_user: CurrentUser, db: DbSession):
    """
    Create booking and queue confirmation email.

    PATTERN:
    1. Create booking in database
    2. Queue Celery task to send email
    3. Return response immediately

    WHY Celery:
    - Email is SLOW (1-5 seconds)
    - Don't block user's request
    - If email fails, Celery auto-retries
    - Can monitor email delivery with Flower

    NEXT STEPS:
    1. Uncomment send_booking_confirmation_email.delay()
    2. Create email templates in app/templates/
    3. Configure SMTP in app/core/config.py
    4. Test with Celery worker running
    """

    # Create booking
    booking = Booking(...)
    db.add(booking)
    await db.commit()

    # Queue email task (returns immediately)
    send_booking_confirmation_email.delay(
        user_email=current_user.email,
        booking_id=str(booking.id),
    )

    # Return immediately (email sends in background)
    return {"booking_id": booking.id, "status": "created"}
```

### Pattern 2.3: Scheduled Task (Payouts)

```python
from celery import shared_task
from app.workers.celery_config import celery_app

@shared_task(
    name="app.tasks.payment_tasks.process_weekly_payouts",
    bind=True,
)
def process_weekly_payouts(self):
    """
    Process weekly payouts to teachers.

    This task is scheduled to run every Monday at 9 AM via Celery Beat.
    See: app/workers/celery_config.py for schedule.

    CRITICALITY: 🔴 FINANCIAL - CRITICAL

    Flow:
    1. Get all teachers with pending earnings
    2. For each teacher:
       a. Calculate total earnings for week
       b. Deduct fees/taxes
       c. Initiate eSewa transfer
       d. Log transaction
       e. Send email confirmation
    3. Update payout status in database
    4. Send admin report

    NEXT STEPS:
    1. Implement teacher earnings calculation
    2. Integrate with eSewa API for transfers
    3. Create payout logging/audit trail
    4. Add error notifications to admin
    5. Test with mock data before production
    """
    try:
        from app.models.teacher import Teacher
        from app.models.payment import Payout, PayoutStatus
        from app.db.session import get_async_session

        # TODO: Implement actual payout logic
        # This is a stub showing the structure

        logger.info("Starting weekly payout process...")

        # 1. Get all teachers with earnings
        teachers = get_teachers_with_pending_earnings()

        for teacher in teachers:
            # 2. Calculate earnings
            earnings = calculate_teacher_earnings(teacher.id)

            # 3. Prepare payout
            payout = Payout(
                teacher_id=teacher.id,
                amount=earnings,
                status=PayoutStatus.PENDING,
            )

            # 4. Initiate eSewa transfer
            transaction_id = initiate_esewa_transfer(
                phone=teacher.phone,
                amount=earnings,
            )

            # 5. Update status
            payout.transaction_id = transaction_id
            payout.status = PayoutStatus.PROCESSING
            save_payout(payout)

            # 6. Send email to teacher
            send_payout_email(teacher.email, earnings)

        logger.info(f"Processed payouts for {len(teachers)} teachers")
        return {"status": "completed", "teachers_processed": len(teachers)}

    except Exception as exc:
        logger.error(f"Payout processing failed: {exc}")
        # Send alert to admin
        send_admin_alert(f"Payout processing failed: {exc}")
        raise  # Re-raise so Beat scheduler knows it failed
```

---

## Part 3: Comparison Cheat Sheet

### When to use BackgroundTasks?

```python
# YES: Token blacklisting
background_tasks.add_task(blacklist_token, jti, ttl)

# YES: Socket.IO notifications
background_tasks.add_task(emit_socket_event, user_id, event)

# YES: Simple notification save
background_tasks.add_task(save_notification, user_id, message)
```

### When to use Celery?

```python
# YES: Financial transaction
process_payment_webhook.delay(transaction_id, booking_id, amount)

# YES: Weekly scheduled task
process_weekly_payouts.delay()  # Scheduled by Beat

# YES: Email with retry
send_booking_confirmation_email.delay(user_email, booking_id)

# YES: PDF generation
generate_invoice_pdf.delay(booking_id)
```

---

## 📊 Performance Summary

| Pattern         | Tool            | Speed | Reliability | When            |
| --------------- | --------------- | ----- | ----------- | --------------- |
| Token blacklist | BackgroundTasks | 10ms  | OK          | Logout          |
| Socket.IO emit  | BackgroundTasks | 50ms  | OK          | Chat message    |
| DB read receipt | BackgroundTasks | 20ms  | OK          | Message read    |
| Payment webhook | Celery          | 5s    | 🔴 CRITICAL | Receive payment |
| Weekly payout   | Celery Beat     | 30s   | 🔴 CRITICAL | Monday 9AM      |
| Email confirm   | Celery          | 3s    | High        | Booking created |

---

## ✅ Implementation Checklist

### BackgroundTasks

- [ ] Token blacklist on logout
- [ ] Socket.IO message notifications
- [ ] Read receipt updates
- [ ] Simple notification saves

### Celery

- [ ] Payment webhook processing
- [ ] Email notifications with retry
- [ ] Weekly payout scheduler
- [ ] Invoice PDF generation
- [ ] Cleanup scheduled tasks

---

**Next**: See ENDPOINT_EXAMPLES.md for full stub endpoints with TODOs
