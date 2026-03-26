# 🎯 Action Plan: BackgroundTasks vs Celery Implementation

**Status**: Ready for Implementation  
**Timeline**: ~7 hours  
**Priority**: HIGH

---

## ✅ What You Confirmed

**Your Question**: "Are we using celery for simple tasks like token blacklisting, simple notifications through socket.io? Can we use native background tasks feature from fastapi instead for those tasks where reliability is not non-negotiable?"

**Answer**: **YES! 100% correct.**

---

## 📋 Phase 1: BackgroundTasks (Simple Tasks) - 2 Hours

### **1.1 Token Blacklist on Logout (30 min)**

**File**: `backend/app/api/v1/endpoints/auth.py`

**Current Problem**:

```python
# Current (BLOCKING)
if jti and exp:
    await blacklist_jti(jti, int(exp))  # ← Waits for Redis, blocks response
```

**What to Change**:

- Add `BackgroundTasks` import from FastAPI
- Add `background_tasks: BackgroundTasks` parameter to `/logout` endpoint
- Remove `await` from `blacklist_jti()` call
- Queue it as background task instead
- Response returns instantly without waiting for Redis

**Expected Code Pattern**:

```python
from fastapi import BackgroundTasks

@router.post("/logout")
async def logout(
    db: DbSession,
    response: Response,
    background_tasks: BackgroundTasks,  # ← ADD THIS
    x_refresh_token: str = Header(None, alias="x-refresh-token")
):
    # Clear cookies immediately
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth")

    # Queue token blacklist (doesn't block response)
    if x_refresh_token:
        try:
            payload = decode_token(x_refresh_token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                # Create a sync function wrapper
                background_tasks.add_task(
                    blacklist_token_sync,  # Sync function (not async)
                    jti,
                    exp
                )
        except ValueError:
            pass  # Invalid token, just clear cookies

    return {"message": "logged out"}  # Returns instantly!

# Sync function (required for BackgroundTasks)
def blacklist_token_sync(jti: str, exp: int):
    """Blacklist token in Redis."""
    try:
        from app.db.redis import redis_client
        from time import time
        redis_client.setex(
            f"blacklist:{jti}",
            int(exp) - int(time()),
            "true"
        )
    except Exception as e:
        logger.error(f"Failed to blacklist token: {e}")
```

**Testing**:

- Logout and immediately check response time (should be < 50ms)
- Wait 1 second and verify token is blacklisted in Redis

---

### **1.2 Socket.IO Notifications on Message (30 min)**

**File**: `backend/app/services/communication.py` or create endpoint

**Current Problem**:

```python
# Current (BLOCKING)
socketio_manager.emit_to_user(receiver_id, "new_message", {...})  # ← May block
```

**What to Change**:

- Add `BackgroundTasks` to the endpoint that creates messages
- Separate DB save (critical) from Socket.IO emit (non-critical)
- Queue Socket.IO notification in background
- Response returns after DB save, not after emit

**Expected Code Pattern**:

```python
from fastapi import BackgroundTasks

@router.post("/messages")
async def create_message(
    body: MessageCreate,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,  # ← ADD THIS
    db: DbSession,
):
    """Create message and emit notification in background."""

    # Save message to database (critical, must complete)
    message = Message(
        sender_id=current_user.id,
        receiver_id=body.receiver_id,
        content=body.content,
        is_read=False,
    )
    db.add(message)
    await db.flush()

    # Queue Socket.IO notification in background (non-critical)
    background_tasks.add_task(
        emit_notification_sync,
        str(body.receiver_id),
        str(message.id),
        body.content
    )

    return message  # Returns after DB save, before socket.io emit!

def emit_notification_sync(receiver_id: str, message_id: str, content: str):
    """Emit Socket.IO notification."""
    try:
        from app.utils.socketio_manager import socketio_manager
        socketio_manager.emit_to_user(
            receiver_id,
            "new_message",
            {"id": message_id, "content": content}
        )
    except Exception as e:
        logger.error(f"Failed to emit notification: {e}")
```

**Testing**:

- Send a message and check response time (should be < 100ms for DB save only)
- Wait 1 second and verify client received Socket.IO event

---

### **1.3 Mark Message as Read (30 min)**

**File**: `backend/app/api/v1/endpoints/` (if there's a messages endpoint)

**Current Problem**:

- If you have an endpoint to mark messages as read, it probably awaits DB update

**What to Change**:

- Option A: Keep as simple DB update (fast enough, < 20ms)
- Option B: Queue in BackgroundTasks if you don't need to return updated message

**Expected Code Pattern**:

```python
@router.post("/messages/{id}/read")
async def mark_as_read(
    id: UUID,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    db: DbSession,
):
    """Mark message as read (background update)."""

    # Return success immediately
    background_tasks.add_task(mark_read_sync, id, current_user.id)

    return {"status": "marked_read"}

def mark_read_sync(message_id: UUID, user_id: UUID):
    """Update message read status in DB."""
    try:
        # Update message.is_read = True where id = message_id
        pass
    except Exception as e:
        logger.error(f"Failed to mark message as read: {e}")
```

---

### **1.4 Cleanup: Delete Unnecessary Task Files (10 min)**

**Files to DELETE**:

```bash
# These are NOT needed - we use BackgroundTasks for their use cases
rm backend/app/tasks/notification_tasks.py
rm backend/app/tasks/media_tasks.py
rm backend/app/tasks/cleanup_tasks.py

# Keep only the critical payment tasks
# backend/app/tasks/payment_tasks.py ← KEEP
```

**What Remains**:

```
backend/app/tasks/
├── __init__.py
└── payment_tasks.py  ← Only critical payment tasks
```

---

## 📊 Phase 2: Celery for Payments (3 Hours)

### **2.1 Update payment_tasks.py (1 hour)**

**File**: `backend/app/tasks/payment_tasks.py`

**Current State**: Contains stub tasks that aren't needed

**What to Change**:

- Delete session reminder tasks (use BackgroundTasks if needed)
- Delete no-show detection (can be BackgroundTasks)
- Keep ONLY:
  1. `process_payment_webhook()` - Process eSewa payment
  2. `process_weekly_payouts()` - Celery Beat scheduled task
  3. `retry_failed_payments()` - Celery Beat scheduled task

**Expected Code Pattern** (simplified):

```python
from app.workers.celery_config import celery_app
import logging

logger = logging.getLogger(__name__)

@celery_app.task(
    name="app.tasks.payment_tasks.process_payment_webhook",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def process_payment_webhook(self, transaction_uuid: str, amount: float, booking_id: str):
    """
    Process payment webhook from eSewa.

    Will retry up to 3 times if it fails.
    - Verify payment with eSewa
    - Update booking status
    - Create transaction record
    - Send confirmation email
    """
    try:
        logger.info(f"Processing payment: {transaction_uuid}")

        # TODO: Implement
        # 1. Verify with eSewa API
        # 2. Update Booking.status = ACTIVE
        # 3. Create Transaction record
        # 4. Send email
        # 5. Emit socket notification

        return {"status": "success", "booking_id": booking_id}
    except Exception as exc:
        logger.error(f"Error processing payment: {exc}")
        # Will retry 3 times with 60-second delays
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(
    name="app.tasks.payment_tasks.process_weekly_payouts",
    bind=True,
    max_retries=2,
)
def process_weekly_payouts(self):
    """
    Process weekly payouts every Monday.

    Calculate and pay teachers for completed sessions.
    """
    try:
        logger.info("Processing weekly payouts")

        # TODO: Implement
        # 1. Query completed sessions from last week
        # 2. Calculate teacher earnings
        # 3. Process payment transfers
        # 4. Send email confirmations

        return {"status": "success", "payouts_processed": 0}
    except Exception as exc:
        logger.error(f"Error processing payouts: {exc}")
        raise self.retry(exc=exc, countdown=300)


@celery_app.task(
    name="app.tasks.payment_tasks.retry_failed_payments",
    bind=True,
    max_retries=3,
)
def retry_failed_payments(self):
    """
    Retry failed payments every hour.

    Check failed payments and attempt verification again.
    """
    try:
        logger.info("Retrying failed payments")

        # TODO: Implement
        # 1. Query payments with status FAILED
        # 2. Verify with eSewa again
        # 3. Update status if successful
        # 4. Send notification if max retries exceeded

        return {"status": "success", "retried": 0}
    except Exception as exc:
        logger.error(f"Error retrying payments: {exc}")
        raise self.retry(exc=exc, countdown=300)
```

---

### **2.2 Implement Payment Webhook Endpoint (1 hour)**

**File**: `backend/app/api/v1/endpoints/payments.py`

**Current State**: Has TODO comment

**What to Change**:

```python
from app.tasks.payment_tasks import process_payment_webhook

@router.post("/esewa/callback")
async def esewa_payment_callback(request: Request, db: DbSession):
    """
    eSewa POSTs here after payment attempt.

    On success: Process payment via Celery (with retry)
    On failure: Mark booking cancelled
    """
    payload = await request.json()

    # Verify HMAC signature (quick validation)
    if not verify_esewa_hmac(payload):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Queue payment processing in Celery (will retry if fails)
    process_payment_webhook.delay(
        transaction_uuid=payload["transaction_uuid"],
        amount=float(payload["amount"]),
        booking_id=payload["custom_data"]
    )

    return {"status": "received"}  # Return immediately
```

**Why Celery Here**:

- ✅ Financial transaction - MUST complete
- ✅ If server dies before response, payment would be lost
- ✅ Celery persists task in Redis, retries if fails
- ✅ Can retry 3 times if eSewa API is temporarily down

**Testing**:

- Simulate eSewa callback
- Check that Celery task is queued
- Verify retry logic works if mock API fails

---

### **2.3 Test Celery Setup (30 min)**

**What to Test**:

1. Redis is running: `redis-cli ping` → should return "PONG"
2. Celery worker starts: `celery -A app.workers.celery_app worker --loglevel=info`
3. Payment webhook task is queued
4. Task executes with retry logic
5. Use Flower to monitor: `celery -A app.workers.celery_app flower`

---

## ⏰ Phase 3: Celery Beat - Weekly Payouts (2 Hours)

### **3.1 Set Up Celery Beat Schedule**

**File**: `backend/app/workers/celery_config.py`

**Current State**: Celery Beat already configured (if it exists)

**What to Add** (if not already there):

```python
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    # Run every Monday at 2 AM
    'process-weekly-payouts': {
        'task': 'app.tasks.payment_tasks.process_weekly_payouts',
        'schedule': crontab(hour=2, minute=0, day_of_week=0),  # Monday
    },
    # Run every hour to retry failed payments
    'retry-failed-payments': {
        'task': 'app.tasks.payment_tasks.retry_failed_payments',
        'schedule': crontab(minute=0),  # Every hour
    },
}
```

**Testing**:

- Start Celery Beat: `celery -A app.workers.celery_app beat --loglevel=info`
- Verify tasks are scheduled in Flower
- Manually trigger tasks for testing

---

## 📈 Implementation Timeline

```
Week 1:
├─ Day 1 (2h): Phase 1 - BackgroundTasks
│  ├─ Token blacklist
│  ├─ Socket.IO notifications
│  └─ Delete unnecessary tasks
│
└─ Days 2-3 (3h): Phase 2 - Celery Payments
   ├─ Update payment_tasks.py
   ├─ Implement payment endpoint
   └─ Test payment workflow

Week 2:
└─ Day 4 (2h): Phase 3 - Celery Beat
   ├─ Set up weekly payout scheduler
   ├─ Test scheduled execution
   └─ Set up monitoring (Flower)
```

---

## ✨ Key Implementation Rules

### **BackgroundTasks Rules**:

1. ✅ Function MUST be **sync** (not async)
2. ✅ Use `background_tasks.add_task(func, arg1, arg2)`
3. ✅ Endpoint returns before task completes
4. ✅ Perfect for: < 100ms operations, fire-and-forget

### **Celery Rules**:

1. ✅ Function MUST be decorated with `@celery_app.task`
2. ✅ Use `function.delay(arg1, arg2)` to queue
3. ✅ Endpoint returns immediately (task queued)
4. ✅ Perfect for: critical, long-running, must-complete operations

---

## 📚 Reference Files

- ✅ **docs/CORRECT_TASK_ALLOCATION.md** - Detailed task allocation matrix
- ✅ **docs/08-async-task-strategy/PATTERNS.md** - Code patterns for both approaches
- ✅ **app/workers/celery_config.py** - Celery configuration (READY)
- ✅ **app/tasks/payment_tasks.py** - To be updated with critical tasks only

---

## 🎯 Next Steps

1. **Read** `docs/CORRECT_TASK_ALLOCATION.md` to confirm strategy
2. **Phase 1**: Implement BackgroundTasks (2 hours)
3. **Phase 2**: Implement Celery for payments (3 hours)
4. **Phase 3**: Set up Celery Beat (2 hours)

**Total**: ~7 hours for complete implementation

**Ready to start?** Let me know which phase to begin! 🚀
