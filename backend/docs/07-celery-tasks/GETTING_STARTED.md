# 🚀 Celery: Getting Started (5 Minutes)

**Time**: 5 minutes  
**Goal**: Understand why Celery and see quick start

---

## ❓ Why Celery?

### The Problem

Some operations are slow and block user requests:

- Sending emails (2-5 seconds)
- Processing payments (1-3 seconds)
- Generating PDFs (5-10 seconds)
- Weekly payouts (30+ seconds)
- Cleanup operations (variable)

**Without Celery:**

```
User sends request → Wait for slow operation → Get response (slow!)
```

**With Celery:**

```
User sends request → Queue task → Get response immediately ✅
                   → Background worker processes task → Done
```

---

## ✅ What You Get

### ✨ For Users

- ⚡ Instant response to requests
- 🎯 Non-blocking operations
- 📧 Emails arrive eventually (retried if failed)
- 💰 Payouts processed reliably

### ✨ For Developers

- 🔄 Automatic retries on failure
- 📊 Task monitoring & status
- ⏰ Scheduled tasks (cron jobs)
- 🛡️ Error handling & logging
- 🚀 Easy to scale (multiple workers)

---

## 🎯 Your Use Cases

### 1️⃣ Notifications (5 Tasks)

**When to use**: You need to send something (email, push, SMS)

```python
# Queue in endpoint (returns immediately)
send_payment_receipt_email.delay(user_id, booking_id, amount)

# User gets response
# Background: Email sends asynchronously
# If fails: Auto-retry up to 3 times
```

**Tasks**:

- Send session reminders
- Send booking status emails
- Send payment receipts
- Send push notifications
- Check for no-shows

---

### 2️⃣ Payments (4 Tasks)

**When to use**: Heavy financial processing

```python
# Queue after payment webhook
process_payment_webhook.delay(booking_id, transaction_id, amount)

# User gets immediate response
# Background: Verification, emails, notifications (all in parallel)
```

**Tasks**:

- Process weekly payouts to teachers
- Retry failed payments
- Process payment webhooks
- Generate invoice PDFs

---

### 3️⃣ Media (3 Tasks)

**When to use**: File handling and processing

```python
# Queue after file upload
process_file_metadata.delay(file_public_id, user_id)

# User gets response
# Background: Extract metadata, generate thumbnails, validate
```

**Tasks**:

- Extract file metadata
- Generate recording summaries
- Compress images

---

### 4️⃣ Cleanup (5 Tasks)

**When to use**: Database maintenance

```python
# Runs automatically on schedule
cleanup_old_notifications.delay()  # Every day
archive_old_messages.delay()       # Every week
```

**Tasks**:

- Delete old notifications
- Remove orphaned files
- Archive old messages
- Mark expired sessions
- Handle inactive users

---

## 🔧 Architecture

```
┌─────────────────────────────────────────┐
│         FastAPI Application             │
│  (app/main.py, endpoints, services)     │
└─────────────────────┬───────────────────┘
                      │
          Queue task (non-blocking)
                      ↓
┌─────────────────────────────────────────┐
│     Redis Message Broker                │
│  (app.tasks.notification_tasks.send_... │
│   app.tasks.payment_tasks.process_...   │
│   ...)                                  │
└─────────────────────┬───────────────────┘
                      │
      Pick up and process
                      ↓
┌─────────────────────────────────────────┐
│    Celery Worker (Background)           │
│  (celery -A app.workers.celery_config   │
│   worker --loglevel=info)               │
└─────────────────────┬───────────────────┘
                      │
            Update database
            Send emails
            Make API calls
                      ↓
┌─────────────────────────────────────────┐
│   External Services (Email, Payment     │
│   APIs, S3, etc.)                       │
└─────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### Step 1: Install (1 minute)

```bash
# Add to poetry
poetry add celery

# Or pip
pip install celery
```

### Step 2: Verify Configuration (1 minute)

```bash
# Check your .env has Redis URL
cat .env | grep REDIS
cat .env | grep CELERY

# Should output:
# REDIS_URL=redis://localhost:6379/0
# CELERY_BROKER_URL=redis://localhost:6379/0
# CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

### Step 3: Start Worker (1 minute)

```bash
# In a new terminal, in backend directory
celery -A app.workers.celery_config worker --loglevel=info
```

You should see:

```
 -------------- celery@computer-name v5.x.x (main)
---- **** -----
--- * ***  * -- Worker Online
-- * - **** ---  - Concurrency: 4
- ** ----------  - Pool: prefork
- ** ----------  - Events: ON
    ---- **** -----
```

### Step 4: Queue a Task (2 minutes)

From your FastAPI endpoint:

```python
from app.tasks.notification_tasks import send_payment_receipt_email

@router.post("/test-task")
async def test_task():
    # Queue task (non-blocking)
    result = send_payment_receipt_email.delay(
        user_id="user-123",
        booking_id="booking-456",
        amount=500.00
    )

    # Return immediately
    return {
        "status": "queued",
        "task_id": result.id  # Can check status with this
    }
```

---

## 📊 What Happens Next?

### In Your Browser

```json
{
  "status": "queued",
  "task_id": "abc123def456"
}
```

✅ You get instant response!

### In Worker Terminal

```
[2026-03-26 10:30:45,123: INFO/MainProcess]
  Task app.tasks.notification_tasks.send_payment_receipt_email[abc123def456]
  received

[2026-03-26 10:30:47,456: INFO/Worker-1]
  Task app.tasks.notification_tasks.send_payment_receipt_email[abc123def456]
  succeeded in 2.333s: {'status': 'success', 'booking_id': 'booking-456', ...}
```

✅ Worker processed it in background!

### In Database

Email is sent, payment receipt created, user notified.

---

## 🎓 Task Lifecycle

```
Queue Task (Fast)
    ↓
  [PENDING]
    ↓
Worker picks it up
    ↓
  [STARTED]
    ↓
Task executes
    ↓
Success → [SUCCESS] → Done ✅
    or
Fail → [FAILURE] → Auto-retry ↩️
    ↓
If retries exceeded → [FAILED] → Log & alert
```

---

## 🔍 Monitor Execution

### Option 1: Check Worker Terminal

Watch real-time output as tasks execute.

### Option 2: Use Flower (Web UI)

```bash
# In another terminal
pip install flower
celery -A app.workers.celery_config flower

# Visit: http://localhost:5555
```

### Option 3: Check Redis Directly

```bash
# In another terminal
redis-cli

# See all tasks
> keys *

# Get task result (if completed)
> get celery-task-meta-abc123def456
```

---

## 📖 Next Steps

1. ✅ You just learned why Celery
2. ✅ You started the worker
3. ✅ You queued a test task

### Now:

- Read: [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
- Read: [CELERY_CONFIG.md](./CELERY_CONFIG.md) - Configuration details
- Read: [HOW_TO_QUEUE_TASK.md](./HOW_TO_QUEUE_TASK.md) - Queue from endpoints
- See: [CODE_EXAMPLES.md](./CODE_EXAMPLES.md) - 20+ working examples
- Implement: [TASK_REFERENCE.md](./TASK_REFERENCE.md) - Start implementing tasks

---

## ❓ Common Questions

**Q: Will my tasks be lost if the worker crashes?**
A: No! Tasks stay in Redis queue until processed. Worker will pick them up when it restarts.

**Q: How many workers do I need?**
A: Start with 1, scale based on task volume. Each worker handles multiple tasks concurrently.

**Q: Can I have scheduled tasks?**
A: Yes! Celery Beat handles this. See [HOW_TO_SCHEDULE_TASK.md](./HOW_TO_SCHEDULE_TASK.md)

**Q: What if a task fails?**
A: Auto-retry (configurable). If all retries fail, alert is logged. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

**Q: How do I know if a task succeeded?**
A: Check worker logs, use Flower web UI, or query Redis directly.

---

## 🎯 You're Ready!

**Status**: ✅ Celery is running  
**Next**: Check the [README.md](./README.md) for full documentation index
