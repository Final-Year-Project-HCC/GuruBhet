# 📊 Async Strategy Visual Guide

Quick reference for choosing between BackgroundTasks and Celery.

---

## 🎯 Decision Tree

```
┌─────────────────────────────────────────────────────┐
│  Is this task < 100ms AND not mission-critical?    │
└───────────┬─────────────────────────────────────────┘
            │
    ┌───────┴───────┐
    │ YES           │ NO
    ▼               ▼
┌─────────────┐  ┌──────────────────────────┐
│BACKGROUND  │  │Is money involved (🔴)?   │
│TASKS ✅    │  │OR scheduled OR long(>1s)?│
│            │  └──────────┬────────────────┘
│• Fast      │            │
│• Simple    │      ┌─────┴─────┐
│• Local     │      │ YES       │ NO
└─────────────┘      ▼           ▼
              ┌─────────────┐  ┌──────────┐
              │CELERY ✅    │  │Question? │
              │            │  │Not sure? │
              │• Retry     │  │Ask team! │
              │• Reliable  │  └──────────┘
              │• Scheduled │
              └─────────────┘
```

---

## 📋 Comparison Table

```
╔════════════════════╦═════════════════╦═════════════════╗
║ Feature            ║ BackgroundTasks ║ Celery          ║
╠════════════════════╬═════════════════╬═════════════════╣
║ Speed              ║ < 1ms queue     ║ < 5ms queue     ║
║ Execution          ║ Thread pool     ║ Worker process  ║
║ Persistence        ║ ❌ No           ║ ✅ Redis        ║
║ Survives crash     ║ ❌ No           ║ ✅ Yes          ║
║ Auto-retry         ║ ❌ No           ║ ✅ Yes (3x)     ║
║ Scheduling         ║ ❌ No           ║ ✅ Beat         ║
║ Monitoring         ║ ❌ No           ║ ✅ Flower       ║
║ Scaling            ║ ❌ Single proc  ║ ✅ Multi-worker ║
║ Max runtime        ║ System memory   ║ Configurable    ║
║ Setup complexity   ║ ⭐ Easy         ║ ⭐⭐ Medium      ║
╚════════════════════╩═════════════════╩═════════════════╝
```

---

## 🏃 BackgroundTasks: When to Use

```
✅ YES, use BackgroundTasks for:
   └─ Token blacklist on logout
   └─ Socket.IO message notifications
   └─ Read receipt updates
   └─ Typing indicators
   └─ Simple notifications to DB
   └─ Anything < 100ms

❌ NO, don't use BackgroundTasks for:
   └─ Email (slow, flaky, needs retry)
   └─ Payment (critical, must not lose)
   └─ Scheduled tasks (hourly, daily)
   └─ Long operations (> 1 second)
   └─ Anything that must survive restart
```

---

## 🔴 Celery: When to Use

```
✅ YES, use Celery for:
   └─ Payment processing (🔴 CRITICAL)
   └─ Weekly payouts (🔴 CRITICAL)
   └─ Email notifications (slow)
   └─ Invoice PDF generation (long)
   └─ Session recording summaries
   └─ Scheduled cleanup tasks
   └─ Anything critical or long-running

❌ NO, don't use Celery for:
   └─ Token blacklist (too slow, unnecessary)
   └─ Socket.IO (adds latency)
   └─ Simple DB updates (overkill)
   └─ Anything < 100ms
```

---

## 💼 Your Use Cases

### Phase 1: BackgroundTasks (Week 1)

```
┌──────────────────────────────┐
│   Token Blacklist (logout)   │ 10ms  ✅ BackgroundTasks
└──────────────────────────────┘

┌──────────────────────────────┐
│ Socket.IO Notification       │ 50ms  ✅ BackgroundTasks
│ (new message arrived)        │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Read Receipt Update (DB)     │ 20ms  ✅ BackgroundTasks
└──────────────────────────────┘
```

### Phase 2: Celery Payments (Week 2)

```
┌──────────────────────────────┐
│ Payment Webhook Processing   │ 5s    🔴 CRITICAL ✅ Celery
│ (eSewa callback)             │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Weekly Payouts to Teachers   │ 30s   🔴 CRITICAL ✅ Celery
│ (Monday 9 AM)                │       (Scheduled)
└──────────────────────────────┘
```

### Phase 3: Celery Other (Week 3)

```
┌──────────────────────────────┐
│ Booking Confirmation Email   │ 3s    ✅ Celery (with retry)
└──────────────────────────────┘

┌──────────────────────────────┐
│ Session Reminder Emails      │ 5s    ✅ Celery (scheduled)
│ (Every 30 min)               │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Cleanup Tasks (hourly)       │ 10s   ✅ Celery (scheduled)
│ (Delete old data)            │
└──────────────────────────────┘
```

---

## 🔄 Flow Diagram: BackgroundTasks

```
Request arrives
    ↓
Do synchronous work
(save to DB, etc)
    ↓
    ├─ Task A: Return 200 immediately
    │
    └─ Task B (in thread pool):
       ├─ Emit Socket.IO event
       ├─ Log result
       └─ Continue in background

User sees response: 200 OK (within 100ms)
Task B continues: ✅ Completes or silently fails
```

---

## 🔄 Flow Diagram: Celery

```
Request arrives
    ↓
Validate input (< 100ms)
    ↓
Queue task in Redis
    ↓
Return 200 immediately

User sees response: 200 OK (within 100ms)

↓ Meanwhile in Worker ↓

Task picked from Redis queue
    ↓
Task executes (3s-30s)
    ↓
On failure: Auto-retry (up to 3 times)
    ↓
Log result to file/DB
```

---

## ⏱️ Timing Examples

### BackgroundTasks (< 100ms total)

```
API Endpoint:  |---------| (5ms)  Save to DB
               |----------| (10ms) Return 200
                          |---| (10ms) Emit Socket.IO (in background)

Total user sees: 15ms to response
```

### Celery (User sees response immediately)

```
API Endpoint:  |--------| (5ms)  Validate
               |----| (20ms) Queue in Redis
               |-----| (25ms) Return 200 ← User sees response now

Worker:                        |----------| (5s) Process payment
                               |------| (2s) Call eSewa API
                               |--| (1s) Update DB
                               Done! ← User might see async notification
```

---

## 📱 Examples at a Glance

### BackgroundTasks Example

```python
@app.post("/logout")
async def logout(background_tasks: BackgroundTasks):
    # Immediate: Clear cookies
    response.delete_cookie("access_token")

    # Background: Blacklist token in Redis (< 10ms)
    background_tasks.add_task(blacklist_token, jti, ttl)

    # Return to user: < 100ms
    return {"message": "logged out"}
```

### Celery Example

```python
@app.post("/webhooks/payment")
async def payment_webhook(payload: dict):
    # Immediate: Validate (< 100ms)
    if not validate_signature(payload):
        return 400

    # Queue: Task in Redis
    process_payment_webhook.delay(
        transaction_id=payload["id"]
    )

    # Return to user: 200 OK (< 100ms)
    return {"status": "received"}

# Worker processes asynchronously:
# - Verify payment with eSewa API (slow)
# - Update booking status (DB)
# - Update teacher payout ledger
# - Send confirmation email
# - Log transaction
```

---

## 🎯 Decision Checklist

For each task, answer these questions:

```
1. Does it complete in < 100ms?
   YES → BackgroundTasks
   NO  → Go to 2

2. Is money involved (🔴 CRITICAL)?
   YES → CELERY
   NO  → Go to 3

3. Does it need to survive server restart?
   YES → CELERY
   NO  → Go to 4

4. Does it run on a schedule (hourly, daily)?
   YES → CELERY
   NO  → Go to 5

5. Does it call external APIs (email, payments)?
   YES → CELERY (for retry)
   NO  → BackgroundTasks OK

Final answer: Use the tool from above!
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────┐
│            FastAPI Endpoints                │
│  (Request/Response handling)                │
└────────┬──────────────────────┬─────────────┘
         │                      │
    FAST │ (< 100ms)    CRITICAL│ (Money/Scheduled)
    WORK │                      │
         ▼                      ▼
    ┌─────────────┐        ┌──────────────┐
    │Background   │        │Celery Queue  │
    │Tasks        │        │(Redis)       │
    │ • Immediate │        │ • Persistent │
    │ • Thread    │        │ • Reliable   │
    │   Pool      │        │ • Retry      │
    └──────┬──────┘        └──────┬───────┘
           │                      │
           ▼ FIRE & FORGET         ▼ RELIABLE
    ┌──────────────────────────────────────┐
    │         Redis                        │
    │  (Session cache + Message broker)    │
    └──────────────────────────────────────┘
           │                      │
           ▼                      ▼
    ┌──────────────┐        ┌──────────────┐
    │PostgreSQL    │        │Celery Worker │
    │(notifications)        │(Background)  │
    └──────────────┘        └──────────────┘
           │                      │
      Persisted              Processing
```

---

## ✅ Verification Checklist

### After Phase 1 (BackgroundTasks)

- [ ] Logout completes in < 100ms
- [ ] Token is blacklisted in Redis
- [ ] Messages appear instantly via Socket.IO
- [ ] Read receipts update in DB

### After Phase 2 (Celery Payments)

- [ ] Webhook returns 200 immediately
- [ ] Task visible in Flower dashboard
- [ ] Task retries on failure
- [ ] Payment status updates correctly
- [ ] Teacher payout ledger updated

### After Phase 3 (Celery Other)

- [ ] Emails sent with retry
- [ ] Scheduled tasks run automatically
- [ ] All notifications working

### After Phase 4 (Monitoring)

- [ ] Flower shows all tasks
- [ ] Can see worker status
- [ ] Can see task history
- [ ] Can monitor performance

---

## 🚀 Quick Start Commands

### Start Development

```bash
# Terminal 1: FastAPI
poetry run uvicorn app.main:app --reload

# Terminal 2: Redis (if not running)
redis-server

# Terminal 3: Celery Worker
celery -A app.workers.celery_config worker --loglevel=info

# Terminal 4: Celery Beat (scheduler)
celery -A app.workers.celery_config beat --loglevel=info

# Terminal 5: Flower (monitoring, http://localhost:5555)
celery -A app.workers.celery_config flower
```

### Test BackgroundTasks

```bash
# No setup needed! Use your API endpoints
curl -X POST http://localhost:8000/api/v1/auth/logout
```

### Test Celery

```bash
# 1. Check Flower: http://localhost:5555
# 2. Send webhook test:
curl -X POST http://localhost:8000/api/v1/payments/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"test-123"}'

# 3. See task in Flower dashboard
```

---

## 📚 Documentation Map

```
START HERE (pick one):
├─ COMPLETE_OVERVIEW.md  ← Full strategy
├─ README.md             ← Decision matrix
└─ THIS FILE             ← Visual guide (you are here)

THEN READ:
├─ PATTERNS.md           ← Code patterns
├─ ENDPOINT_EXAMPLES.md  ← Stub endpoints
└─ IMPLEMENTATION_GUIDE.md ← Step-by-step

FOR DETAILS:
├─ 07-celery-tasks/      ← Celery-specific
├─ 01-realtime-communication/ ← Socket.IO
└─ 02-booking-flow/      ← Business logic
```

---

## 🎓 Learning Timeline

| Day       | Task                         | Duration      | Output                    |
| --------- | ---------------------------- | ------------- | ------------------------- |
| 1         | Read README.md + PATTERNS.md | 1 hour        | Understand strategy       |
| 1         | Read ENDPOINT_EXAMPLES.md    | 30 min        | Know what to implement    |
| 2-3       | Implement Phase 1            | 2 hours       | 3 BackgroundTasks working |
| 4-5       | Implement Phase 2            | 3 hours       | 2 Celery tasks working    |
| 6         | Implement Phase 3            | 2 hours       | All tasks working         |
| 7         | Setup Flower + test          | 1 hour        | Production ready          |
| **Total** |                              | **8.5 hours** | **System complete**       |

---

**Status**: ✅ Ready to implement  
**Start**: Read COMPLETE_OVERVIEW.md next  
**Timeline**: 8 hours over 4 weeks
