# ✅ Correct Task Allocation: BackgroundTasks vs Celery

**Date**: Current Implementation Review  
**Status**: Strategy Clarification & Action Plan  
**Priority**: HIGH - Affects architecture decisions

---

## 🎯 Executive Summary

Your question is **100% correct**: We should NOT use Celery for simple, non-critical tasks.

**Current State (PROBLEMATIC)**:

- ❌ Created 17 Celery task templates
- ❌ Many are over-engineered for their use case

**Correct State (NEEDED)**:

- ✅ Use **BackgroundTasks** for: token blacklist, notifications, status updates (simple, < 100ms)
- ✅ Use **Celery** for: payments, payouts, critical operations (must persist, must retry)

---

## 📊 Task Categorization Matrix

### ✅ **BackgroundTasks** (Fire-and-Forget, Same Process)

| Task                          | Why BackgroundTasks                         | Why NOT Celery         | Implementation              |
| ----------------------------- | ------------------------------------------- | ---------------------- | --------------------------- |
| **Token Blacklist on Logout** | Simple Redis write, immediate, non-critical | Overkill               | `auth.py` - inline          |
| **Socket.IO Notification**    | Must be immediate for UX, no retry needed   | Overkill, adds latency | `communication.py` - inline |
| **Mark Message as Read**      | Simple DB update, doesn't affect booking    | Overkill               | `communication.py` - inline |
| **Send System Notification**  | Simple DB insert, fire-and-forget           | Overkill               | `communication.py` - inline |

### 🔴 **Celery** (Persistent Queue, Retry Logic)

| Task                        | Why Celery                                           | Why NOT BackgroundTasks       | Implementation                   |
| --------------------------- | ---------------------------------------------------- | ----------------------------- | -------------------------------- |
| **Process Payment Webhook** | ⚠️ FINANCIAL - must complete even if server restarts | Would be lost if server dies  | `payment_tasks.py` - Celery task |
| **Weekly Payouts**          | ⚠️ FINANCIAL - scheduled, must persist               | Needs scheduling, persistence | `payment_tasks.py` - Celery Beat |
| **Payment Receipt Email**   | Important but can retry                              | Needs retry logic             | `payment_tasks.py` - Celery task |
| **Retry Failed Payments**   | Critical error recovery                              | Needs scheduling, retry state | `payment_tasks.py` - Celery Beat |

### ❓ **Optional** (Depends on Requirements)

| Task              | Current Recommendation                | Future Option                          |
| ----------------- | ------------------------------------- | -------------------------------------- |
| Session reminders | BackgroundTasks (simple notification) | Celery if you need guaranteed delivery |
| No-show detection | BackgroundTasks (periodic check)      | Celery Beat if scheduling is complex   |
| Cleanup tasks     | Remove (don't implement yet)          | Celery Beat if needed later            |
| Media processing  | Remove (don't implement yet)          | Celery if heavy processing needed      |

---

## 🏗️ Current Codebase Analysis

### **auth.py** - Token Blacklist ✅ Ready for BackgroundTasks

**Current Implementation**:

```python
# POST /logout
@router.post("/logout")
async def logout(db: DbSession, response: Response, x_refresh_token: str = Header(None)):
    # Blocking call to blacklist JTI in Redis
    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        await blacklist_jti(jti, int(exp))  # ← THIS BLOCKS RESPONSE

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth")
    return {"message": "logged out"}
```

**Problem**:

- Awaiting `blacklist_jti()` blocks response (can be 5-50ms depending on Redis latency)
- Non-critical operation doesn't warrant blocking user's logout experience

**Solution**: Use BackgroundTasks

```python
from fastapi import BackgroundTasks

@router.post("/logout")
async def logout(
    db: DbSession,
    response: Response,
    background_tasks: BackgroundTasks,  # ← Add this
    x_refresh_token: str = Header(None)
):
    # Clear cookies immediately (returns instantly)
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth")

    # Queue blacklist in background (doesn't block response)
    if x_refresh_token:
        try:
            payload = decode_token(x_refresh_token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                background_tasks.add_task(blacklist_token_sync, jti, exp)
        except ValueError:
            pass  # Invalid token, just clear cookies

    return {"message": "logged out"}  # Returns instantly

def blacklist_token_sync(jti: str, exp: int):
    """Sync function for BackgroundTask (cannot be async)"""
    try:
        from app.db.redis import redis_client
        redis_client.setex(f"blacklist:{jti}", int(exp) - int(time.time()), "true")
    except Exception as e:
        logger.error(f"Failed to blacklist token: {e}")
```

---

### **communication.py** - Socket.IO Notifications ✅ Ready for BackgroundTasks

**Current Implementation**:

```python
# Service method
async def save_and_send_message(
    self, db: AsyncSession, sender_id: UUID, receiver_id: UUID, content: str
) -> Message:
    """Save message and emit Socket.IO notification."""

    message = Message(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        is_read=False,
    )
    db.add(message)
    await db.flush()

    # Emit Socket.IO notification (if blocking)
    socketio_manager.emit_to_user(receiver_id, "new_message", {...})  # ← BLOCKS

    return message
```

**Problem**:

- Socket.IO emit might block if network is slow
- Non-critical notification doesn't need to block message save

**Solution**: Use BackgroundTasks

```python
# In API endpoint
from fastapi import BackgroundTasks

@router.post("/messages")
async def create_message(
    body: MessageCreate,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    db: DbSession,
    communication_service: CommunicationService,
):
    """Create message with background notification."""

    # Save message to database (blocking, but fast)
    message = await communication_service.save_message(
        db, current_user.id, body.receiver_id, body.content
    )

    # Queue Socket.IO notification in background (doesn't block response)
    background_tasks.add_task(
        emit_notification_sync,
        body.receiver_id,
        message.id,
        body.content
    )

    return message  # Returns instantly

def emit_notification_sync(receiver_id: UUID, message_id: UUID, content: str):
    """Sync function for BackgroundTask"""
    try:
        socketio_manager.emit_to_user(
            receiver_id,
            "new_message",
            {"id": str(message_id), "content": content}
        )
    except Exception as e:
        logger.error(f"Failed to emit notification: {e}")
```

---

### **payments.py** - Payment Webhook ✅ Needs Celery

**Current Implementation**:

```python
@router.post("/esewa/callback")
async def esewa_payment_callback(request: Request, db: DbSession):
    """
    eSewa POSTs here after payment attempt.
    TODO: Implement eSewa callback verification and booking activation
    """
    ...
```

**Problem**:

- Currently just a TODO placeholder
- If implemented naively, could fail and lose payment confirmation

**Correct Solution**: Use Celery with Retry

```python
from app.tasks.payment_tasks import process_payment_webhook_task

@router.post("/esewa/callback")
async def esewa_payment_callback(request: Request, db: DbSession):
    """eSewa POSTs here after payment attempt."""

    # Parse eSewa payload
    payload = await request.json()

    # Verify HMAC (quick validation)
    if not verify_hmac(payload):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Queue payment processing in Celery (guarantees completion)
    process_payment_webhook_task.delay(
        transaction_uuid=payload["transaction_uuid"],
        amount=float(payload["amount"]),
        booking_id=payload["custom_data"],
        timestamp=int(time.time())
    )

    return {"status": "received"}  # Returns immediately, Celery handles rest
```

**payment_tasks.py** (Celery task):

```python
@celery_app.task(
    name="app.tasks.payment_tasks.process_payment_webhook",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def process_payment_webhook(self, transaction_uuid: str, amount: float, booking_id: str):
    """Process payment - will retry on failure."""
    try:
        # 1. Verify payment with eSewa API
        # 2. Create Transaction record
        # 3. Update Booking status
        # 4. Send email confirmation
        # 5. Emit Socket.IO notification
        return {"status": "success"}
    except Exception as exc:
        # Retry 3 times with 60-second delays
        raise self.retry(exc=exc, countdown=60)
```

---

## 📋 Files Status & Action Items

### **What We Have** ✅

| File                              | Status            | Action                                           |
| --------------------------------- | ----------------- | ------------------------------------------------ |
| `app/workers/celery_config.py`    | ✅ Created        | KEEP - Ready for payment tasks                   |
| `app/tasks/payment_tasks.py`      | ✅ Created (stub) | KEEP - Implement critical payment logic          |
| `auth.py - logout endpoint`       | ✅ Exists         | MODIFY - Add BackgroundTasks for token blacklist |
| `communication.py`                | ✅ Exists         | MODIFY - Add BackgroundTasks for notifications   |
| `payments.py - callback endpoint` | ⚠️ TODO           | IMPLEMENT - Use Celery for processing            |

### **What We Should Delete** ❌

| File                              | Reason                                        |
| --------------------------------- | --------------------------------------------- |
| `app/tasks/notification_tasks.py` | Not needed - use BackgroundTasks inline       |
| `app/tasks/media_tasks.py`        | Not implemented yet - skip for now            |
| `app/tasks/cleanup_tasks.py`      | Over-engineered - use BackgroundTasks or skip |

---

## 🚀 Implementation Priority

### **Phase 1: BackgroundTasks** (2 hours) ← START HERE

1. ✅ Token blacklist in `auth.py` (30 min)
2. ✅ Socket.IO notifications in `communication.py` (30 min)
3. ✅ Test BackgroundTasks locally (30 min)
4. ✅ Delete unnecessary task files (10 min)

### **Phase 2: Celery - Payments** (3 hours)

1. ✅ Implement `process_payment_webhook()` (1.5 hours)
2. ✅ Implement payment callback endpoint (1 hour)
3. ✅ Test with Redis + Celery worker (30 min)

### **Phase 3: Celery - Weekly Payouts** (2 hours)

1. ✅ Implement `process_weekly_payouts()` (1.5 hours)
2. ✅ Set up Celery Beat schedule (30 min)

---

## 📚 Key Differences: BackgroundTasks vs Celery

### **BackgroundTasks**

```python
from fastapi import BackgroundTasks

# In endpoint
background_tasks: BackgroundTasks

# Queue task (immediately returns)
background_tasks.add_task(my_function, arg1, arg2)

return {"message": "Done"}  # Returns before task completes
```

**Characteristics**:

- ✅ Built-in to FastAPI (no external dependency)
- ✅ Runs in same process as FastAPI worker
- ✅ Perfect for: fire-and-forget, short tasks (< 100ms)
- ❌ Lost if: server process dies/restarts
- ❌ No retry logic
- ❌ No persistence
- ❌ No scheduling

### **Celery**

```python
from app.workers.celery_config import celery_app

@celery_app.task(bind=True, max_retries=3)
def my_task(self, arg1, arg2):
    try:
        # Long operation
        return result
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)

# In endpoint
my_task.delay(arg1, arg2)

return {"message": "Queued"}  # Returns immediately
```

**Characteristics**:

- ✅ Separate worker process (doesn't block main app)
- ✅ Persistent queue (Redis/RabbitMQ)
- ✅ Auto-retry with backoff
- ✅ Monitoring with Flower dashboard
- ✅ Scheduled tasks with Celery Beat
- ❌ More complex setup
- ❌ External dependency (Redis/broker)
- ❌ Overkill for simple operations

---

## ✨ Summary: The Correct Split

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR BACKEND                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FastAPI Endpoints                                      │
│  ├─ POST /auth/logout                                   │
│  │   └─ BackgroundTask: Blacklist token in Redis       │
│  │                                                      │
│  ├─ POST /messages                                      │
│  │   └─ BackgroundTask: Emit Socket.IO notification    │
│  │                                                      │
│  └─ POST /esewa/callback                               │
│      └─ Celery Task: Process payment with retry        │
│                                                         │
│  Celery Tasks (redis://localhost:6379/0)              │
│  ├─ process_payment_webhook() - Retry on failure      │
│  ├─ process_weekly_payouts() - Scheduled Monday        │
│  └─ send_payment_receipt_email() - Retry on failure   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📖 Next Steps

**Recommended Action**:

1. **Read this file** to confirm the strategy is correct ✅
2. **Phase 1: Implement BackgroundTasks** (2 hours)
   - Modify `auth.py` for token blacklist
   - Modify `communication.py` for notifications
   - Delete unnecessary task files
3. **Phase 2: Implement Celery for Payments** (3 hours)
   - Complete `payment_tasks.py`
   - Implement payment callback endpoint
4. **Phase 3: Add Weekly Payouts** (2 hours)
   - Complete weekly payout task
   - Set up Celery Beat schedule

**Total Time**: ~7 hours for full implementation

---

## ✅ Confirmation Checklist

- [x] BackgroundTasks should be used for token blacklist ✓
- [x] BackgroundTasks should be used for Socket.IO notifications ✓
- [x] Celery should be used for payment processing ✓
- [x] Celery should be used for weekly payouts ✓
- [x] Don't over-engineer simple tasks ✓
- [x] Keep Celery infrastructure ready ✓

**You're 100% on the right track!** 🎯
