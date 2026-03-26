# 🚀 Async Task Strategy: BackgroundTasks vs Celery

## Overview

**Goal**: Use the RIGHT tool for the RIGHT task to optimize performance and reliability.

- **FastAPI BackgroundTasks** ✅ = "Fire and forget" immediate operations
- **Celery** ✅ = Persistent, reliable, critical operations

---

## 📊 Decision Matrix

### Use FastAPI BackgroundTasks When:

| Criteria                         | Explanation                                   | Examples                             |
| -------------------------------- | --------------------------------------------- | ------------------------------------ |
| **Quick I/O**                    | Task completes in < 100ms                     | Redis writes, simple notifications   |
| **Not critical**                 | OK if it fails silently (retry not essential) | Socket.IO events, push notifications |
| **User sees result immediately** | User gets response without waiting for task   | Login/logout, message sending        |
| **No persistence needed**        | Don't need to track if task completed         | In-memory operations                 |
| **Tied to request/response**     | Task is directly related to this API call     | Token blacklisting on logout         |

### Use Celery When:

| Criteria                | Explanation                                     | Examples                            |
| ----------------------- | ----------------------------------------------- | ----------------------------------- |
| **Long-running**        | Task takes > 1 second                           | Weekly payout calculations          |
| **CRITICAL**            | Must succeed (financial, legal, data integrity) | Money transfers, invoice generation |
| **Needs retry**         | If server crashes, task must retry              | Payment processing, email delivery  |
| **Scheduled**           | Must run at specific times                      | Cleanup tasks, reminders            |
| **Persistent tracking** | Need to monitor task status                     | Can use Flower, logs                |
| **Heavy computation**   | CPU/memory intensive                            | Video encoding, PDF generation      |
| **External APIs**       | Calling 3rd party with unpredictable latency    | Payment gateway, email service      |

---

## 🎯 Your GuruBhet Use Cases Mapped

### ✅ Use BackgroundTasks

#### 1. **Token Blacklisting (Logout)**

```
When: POST /api/v1/auth/logout
What: Add refresh token JTI to Redis blacklist
Why:
  - Quick Redis I/O (< 10ms)
  - Non-critical (token expires naturally)
  - User already logged out (sees response immediately)
  - Doesn't block logout response
```

#### 2. **Socket.IO Message Notification**

```
When: After saving message to DB
What: Emit "new_message" event to receiver
Why:
  - Fast WebSocket event (< 50ms)
  - Already fast enough for real-time
  - Receiver gets notification immediately
  - If fails, user can refresh and see message in DB
  - No persistence needed (message is in DB)
```

#### 3. **Socket.IO Typing Indicator**

```
When: User types in chat
What: Broadcast "user_typing" event
Why:
  - Real-time visual feedback required
  - Fire-and-forget pattern
  - No state needed (transient)
  - Already handled by Socket.IO
```

#### 4. **Simple In-App Notification**

```
When: Session approved, booking status change (immediate)
What: Save notification to DB, emit Socket.IO event
Why:
  - User needs to know immediately
  - DB write is fast (< 50ms)
  - Socket.IO emission is instant
  - User sees notification in real-time
```

#### 5. **Session Read Receipts**

```
When: User marks message as read
What: Update DB, emit "message_read" event
Why:
  - Quick DB update (< 20ms)
  - Other user sees read status immediately
  - Not critical if missed (shows as unread, user can refresh)
```

---

### ⏳ Use Celery

#### 1. **Weekly Payout Processing** 🔴 CRITICAL

```
When: Scheduled weekly (every Monday)
What: Calculate teacher earnings, process eSewa transfer
Why:
  - FINANCIAL: Money is involved (must succeed)
  - LONG: Calculation + API calls = 5-10 seconds
  - RETRY: If server crashes mid-transfer, MUST retry
  - PERSISTENT: Must track success/failure for audit
  - SCHEDULED: Must run at specific time
Pattern: Celery Beat periodic task
```

#### 2. **Failed Payment Retry** 🔴 CRITICAL

```
When: Payment fails initially
What: Retry eSewa payment verification after 1 hour
Why:
  - FINANCIAL: Money transaction (must succeed)
  - RETRY: Network failure should auto-retry
  - PERSISTENT: Need to log all retry attempts
  - ASYNC: Can't block user request
Pattern: Task queued with retry logic
```

#### 3. **Payment Webhook Processing**

```
When: eSewa sends POST /webhooks/payment
What: Verify signature, update booking/payment status
Why:
  - CRITICAL: Financial transaction status
  - RETRY: Webhook might arrive multiple times
  - ASYNC: Must respond to webhook quickly (< 200ms)
  - PERSISTENT: Need to track all webhook events
Pattern: Queue task immediately, return 200 to eSewa, process async
```

#### 4. **Email Notifications** (Non-Urgent)

```
When: Session reminder, booking status email
What: Send email via SMTP
Why:
  - EXTERNAL API: SMTP might be slow (1-5 sec)
  - RETRY: Email might fail (temporary SMTP outage)
  - ASYNC: Don't block user request
  - PERSISTENT: Log email sent/failed
Pattern: Celery task with retry=True, max_retries=3
```

#### 5. **Invoice PDF Generation**

```
When: User requests invoice after session
What: Generate PDF with booking details, send via email
Why:
  - LONG: PDF generation takes time (2-3 sec)
  - EXTERNAL: Email delivery (3-5 sec)
  - ASYNC: Don't block user request
  - PERSISTENT: Need to track PDF generation
Pattern: Celery task, user polls for status or gets email
```

#### 6. **Cleanup Tasks**

```
When: Scheduled (hourly/daily/weekly)
What: Delete old notifications, archive messages, cleanup uploads
Why:
  - SCHEDULED: Must run at specific times
  - LONG: Multiple DB operations (5-30 sec)
  - SAFE: Can run during off-peak hours
Pattern: Celery Beat periodic tasks
```

#### 7. **Session Recording Summary Generation**

```
When: After session ends (LiveKit recording ready)
What: Fetch recording, generate summary, store transcript
Why:
  - LONG: Video processing (10-30 sec)
  - EXTERNAL: LiveKit API calls
  - ASYNC: Don't block session end response
Pattern: Celery task triggered on session end
```

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Endpoints                            │
└────────┬──────────────────────────────┬──────────────────────────┘
         │                              │
         │ IMMEDIATE RESPONSE           │ DELAYED RESPONSE
         │ (< 100ms tasks)              │ (Critical/Long tasks)
         │                              │
    ┌────▼─────────────────┐       ┌────▼──────────────┐
    │ BackgroundTasks      │       │ Celery Queue      │
    │                      │       │ (Redis broker)    │
    ├──────────────────────┤       ├──────────────────┤
    │ • Token blacklist    │       │ • Payouts        │
    │ • Socket.IO events   │       │ • Payments       │
    │ • Simple notifs      │       │ • Emails         │
    │ • Read receipts      │       │ • Invoices       │
    │ • Typing indicators  │       │ • Cleanup        │
    └────┬─────────────────┘       └────┬─────────────┘
         │                              │
         │ FIRE & FORGET                │ PERSISTENT QUEUE
         │ (no retry)                   │ (with retry logic)
         │                              │
    ┌────▼──────────────────────────────▼──────────────────┐
    │         Redis (Session + Message Broker)             │
    └────┬───────────────────────────────────┬─────────────┘
         │                                   │
    ┌────▼────────────────┐      ┌──────────▼────────────┐
    │  PostgreSQL (DB)    │      │  Celery Workers      │
    │                     │      │  (Background Process)│
    ├─────────────────────┤      ├─────────────────────┤
    │ • Tokens (blacklist)│      │ • Process tasks     │
    │ • Notifications     │      │ • Retry failed      │
    │ • Messages          │      │ • Log results       │
    │ • Payments          │      │ • Call external APIs│
    └─────────────────────┘      └─────────────────────┘
         │
    ┌────▼──────────────────────────┐
    │  External Services             │
    ├────────────────────────────────┤
    │ • eSewa (payments)             │
    │ • SMTP (email)                 │
    │ • LiveKit (recordings)         │
    │ • Cloudinary (files)           │
    └────────────────────────────────┘
```

---

## 📝 Implementation Patterns

### Pattern 1: BackgroundTasks (Simple)

```python
from fastapi import BackgroundTasks, APIRouter

router = APIRouter()

def blacklist_token(jti: str, ttl: int):
    """Background task: Add token to Redis blacklist."""
    from app.db.redis import blacklist_jti
    import asyncio
    asyncio.run(blacklist_jti(jti, ttl))

@router.post("/logout")
async def logout(background_tasks: BackgroundTasks, db: DbSession):
    # Get token from request
    jti = "..."
    ttl = 3600

    # Queue background task (non-blocking)
    background_tasks.add_task(blacklist_token, jti, ttl)

    # Respond immediately (task runs in background)
    return {"message": "Logged out"}
```

### Pattern 2: Celery (Critical)

```python
from fastapi import APIRouter
from app.tasks.payment_tasks import process_payment_webhook

router = APIRouter()

@router.post("/webhooks/payment")
async def payment_webhook(payload: dict, db: DbSession):
    """
    Receive payment webhook from eSewa.

    Next Steps:
    1. Validate signature immediately (< 100ms)
    2. Respond with 200 OK to eSewa immediately
    3. Queue Celery task to process payment

    WHY:
    - Can't process payment in request (too slow)
    - Must respond to eSewa quickly (< 200ms)
    - Payment processing must be reliable (with retry)
    - Must persist transaction history
    """
    # 1. Validate signature quickly
    if not validate_payment_signature(payload):
        return {"status": "error"}, 400

    # 2. Queue Celery task with payload
    process_payment_webhook.delay(
        transaction_id=payload["transaction_id"],
        booking_id=payload["booking_id"],
        amount=payload["amount"],
    )

    # 3. Respond immediately (task runs in worker)
    return {"status": "received"}, 200
```

---

## 🔧 When to Switch from BackgroundTasks to Celery

**Upgrade if ANY of these are true:**

1. ❌ Task is failing silently and you need to know → Add retry logic
2. ❌ Task took 5 min, now it takes 30 min → Need persistent queue
3. ❌ Server crashed during task, task was lost → Need persistent storage
4. ❌ Need to run task at exact time (3 AM) → Use Celery Beat
5. ❌ Multiple failures without retry → Use Celery auto-retry
6. ❌ Business says "data integrity critical" → Use Celery immediately

---

## 📊 Performance Comparison

| Metric                  | BackgroundTasks | Celery                |
| ----------------------- | --------------- | --------------------- |
| **Task queuing**        | < 1ms           | < 5ms                 |
| **Retry on failure**    | ❌ No           | ✅ Yes (configurable) |
| **Survives restart**    | ❌ Lost         | ✅ Persisted          |
| **Scheduled execution** | ❌ No           | ✅ Yes (Beat)         |
| **Task monitoring**     | ❌ No           | ✅ Yes (Flower)       |
| **Multi-worker**        | ❌ Can't scale  | ✅ Yes (distributed)  |
| **Max runtime**         | System memory   | Configurable          |
| **Best for**            | < 100ms tasks   | Everything else       |

---

## ✅ Implementation Checklist

### Phase 1: BackgroundTasks (Immediate)

- [ ] Token blacklist on logout
- [ ] Socket.IO message notifications
- [ ] Simple in-app notifications
- [ ] Read receipts

### Phase 2: Celery (This Week)

- [ ] Payment webhook processing
- [ ] Weekly payout scheduler
- [ ] Email notifications
- [ ] Invoice PDF generation

### Phase 3: Advanced (Next)

- [ ] Session recording summaries
- [ ] Cleanup scheduled tasks
- [ ] Monitoring with Flower

---

## 📚 Documentation Files

1. **README.md** ← You are here
2. **PATTERNS.md** - Code patterns for both approaches
3. **ENDPOINT_EXAMPLES.md** - Stub endpoints with TODOs
4. **MIGRATION_GUIDE.md** - How to upgrade BackgroundTasks to Celery

---

## 🚀 Next Steps

1. Read **PATTERNS.md** for code examples
2. Check **ENDPOINT_EXAMPLES.md** for stub endpoints
3. Implement Phase 1 (BackgroundTasks) this week
4. Implement Phase 2 (Celery) next week
5. Use **MIGRATION_GUIDE.md** if you need to upgrade

---

**Status**: ✅ Ready for implementation  
**Timeline**: Phase 1 = 2 hours, Phase 2 = 4 hours, Phase 3 = 2 hours
