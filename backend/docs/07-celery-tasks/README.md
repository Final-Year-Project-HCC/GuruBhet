# 📋 Celery Background Tasks Documentation

**Version**: 1.0  
**Last Updated**: March 26, 2026

---

## 📚 Overview

This folder contains comprehensive documentation on GuruBhet's Celery background task system.

Celery enables asynchronous task processing, allowing long-running or non-blocking operations to execute in the background without blocking user requests.

---

## 📂 Documentation Contents

### Quick Start

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Setup and quick start guide (5 minutes)
- **[INSTALLATION.md](./INSTALLATION.md)** - Detailed installation instructions

### Architecture & Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design and workflow
- **[CELERY_CONFIG.md](./CELERY_CONFIG.md)** - Configuration reference

### Task Reference

- **[TASK_REFERENCE.md](./TASK_REFERENCE.md)** - Complete task catalog
- **[TASKS_BY_CATEGORY.md](./TASKS_BY_CATEGORY.md)** - Tasks organized by use case

### How-To Guides

- **[HOW_TO_RUN_WORKER.md](./HOW_TO_RUN_WORKER.md)** - Running Celery worker
- **[HOW_TO_SCHEDULE_TASK.md](./HOW_TO_SCHEDULE_TASK.md)** - Creating scheduled tasks
- **[HOW_TO_QUEUE_TASK.md](./HOW_TO_QUEUE_TASK.md)** - Queuing tasks from endpoints
- **[HOW_TO_MONITOR.md](./HOW_TO_MONITOR.md)** - Monitoring and debugging

### API Integration

- **[ENDPOINT_INTEGRATION.md](./ENDPOINT_INTEGRATION.md)** - Queue tasks from FastAPI endpoints
- **[SERVICE_INTEGRATION.md](./SERVICE_INTEGRATION.md)** - Queue tasks from services

### Examples & Code

- **[CODE_EXAMPLES.md](./CODE_EXAMPLES.md)** - 20+ working examples
- **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - Implementation tasks

### Deployment & Operations

- **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** - Production deployment
- **[MONITORING_PRODUCTION.md](./MONITORING_PRODUCTION.md)** - Production monitoring
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions

---

## 🎯 Quick Navigation

### "I Want To..."

**...get Celery working in 5 minutes**
→ [GETTING_STARTED.md](./GETTING_STARTED.md)

**...understand the task system**
→ [ARCHITECTURE.md](./ARCHITECTURE.md)

**...see all available tasks**
→ [TASK_REFERENCE.md](./TASK_REFERENCE.md)

**...start the Celery worker**
→ [HOW_TO_RUN_WORKER.md](./HOW_TO_RUN_WORKER.md)

**...queue a task from my endpoint**
→ [HOW_TO_QUEUE_TASK.md](./HOW_TO_QUEUE_TASK.md)

**...create a new task**
→ [HOW_TO_SCHEDULE_TASK.md](./HOW_TO_SCHEDULE_TASK.md)

**...monitor tasks in production**
→ [MONITORING_PRODUCTION.md](./MONITORING_PRODUCTION.md)

**...fix a task issue**
→ [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

**...see code examples**
→ [CODE_EXAMPLES.md](./CODE_EXAMPLES.md)

---

## 📊 Task Categories

### 🔔 Notification Tasks

**Purpose**: Send notifications, reminders, emails  
**Async**: Yes (non-blocking)  
**Retry**: Yes (auto-retry on failure)

- `send_session_reminders` - Remind users before session starts
- `check_session_no_shows` - Detect no-shows automatically
- `send_booking_status_email` - Email on booking status change
- `send_payment_receipt_email` - Send payment receipts
- `send_push_notification` - Push notifications to mobile

**Location**: `app/tasks/notification_tasks.py`

---

### 💳 Payment Tasks

**Purpose**: Handle payments, payouts, financial operations  
**Async**: Yes (heavy processing)  
**Retry**: Yes (critical, must succeed)

- `process_weekly_payouts` - Weekly payout to teachers
- `retry_failed_payments` - Retry failed payment verification
- `process_payment_webhook` - Async webhook processing
- `generate_invoice_pdf` - Generate invoices

**Location**: `app/tasks/payment_tasks.py`

---

### 📁 Media Tasks

**Purpose**: Handle files, images, recordings  
**Async**: Yes (slow processing)  
**Retry**: Yes

- `process_file_metadata` - Extract metadata from uploads
- `generate_session_recording_summary` - Create recording summaries
- `compress_image` - Optimize images for web

**Location**: `app/tasks/media_tasks.py`

---

### 🧹 Cleanup Tasks

**Purpose**: Database maintenance, archival, user management  
**Async**: Yes (can run during off-hours)  
**Retry**: Yes

- `cleanup_old_notifications` - Delete old notifications
- `cleanup_unconfirmed_uploads` - Remove orphaned files
- `archive_old_messages` - Archive chat history
- `cleanup_expired_sessions` - Mark sessions as inactive
- `cleanup_inactive_users` - Handle dormant accounts

**Location**: `app/tasks/cleanup_tasks.py`

---

## 🚀 Current Status

### ✅ Setup

- ✅ `celery_config.py` created with full configuration
- ✅ `app/tasks/` folder created with task templates
- ✅ 16 task templates ready for implementation
- ✅ Beat scheduler configured for 6 periodic tasks
- ✅ Documentation complete

### ⏳ Next Steps

1. Install Celery: `poetry add celery`
2. Configure Redis (should already exist)
3. Implement task logic in each file
4. Test individual tasks
5. Start Celery worker
6. Monitor with Flower

---

## 📖 Task File Structure

```
app/
├── tasks/
│   ├── __init__.py                    (Task initialization)
│   ├── notification_tasks.py          (5 notification tasks)
│   ├── payment_tasks.py               (4 payment tasks)
│   ├── media_tasks.py                 (3 media tasks)
│   └── cleanup_tasks.py               (5 cleanup tasks)
│
└── workers/
    ├── celery_app.py                  (Existing)
    └── celery_config.py               (NEW - Full config)
```

---

## 🎓 Learning Path

### Day 1: Understand Celery

1. Read: [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Read: [CELERY_CONFIG.md](./CELERY_CONFIG.md)
3. Time: 30 minutes

### Day 2: Get It Running

1. Read: [GETTING_STARTED.md](./GETTING_STARTED.md)
2. Follow: [INSTALLATION.md](./INSTALLATION.md)
3. Do: Start Celery worker
4. Time: 1 hour

### Day 3: Use Celery

1. Read: [HOW_TO_QUEUE_TASK.md](./HOW_TO_QUEUE_TASK.md)
2. Review: [CODE_EXAMPLES.md](./CODE_EXAMPLES.md)
3. Queue a task from your code
4. Monitor: [HOW_TO_MONITOR.md](./HOW_TO_MONITOR.md)
5. Time: 1-2 hours

### Day 4: Implement Tasks

1. Pick a task category
2. Read task descriptions in [TASK_REFERENCE.md](./TASK_REFERENCE.md)
3. Implement task logic
4. Test with `celery -A app.workers.celery_config call <task_name>`
5. Time: 2-3 hours per task

### Day 5: Deploy

1. Read: [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)
2. Read: [MONITORING_PRODUCTION.md](./MONITORING_PRODUCTION.md)
3. Deploy to staging/production
4. Time: 1-2 hours

---

## 🔗 File Locations

### Configuration

- `app/workers/celery_config.py` - Main Celery configuration
- `app/core/config.py` - Settings (CELERY_BROKER_URL, etc.)
- `.env` - Environment variables

### Task Definitions

- `app/tasks/__init__.py` - Task module initialization
- `app/tasks/notification_tasks.py` - Notification tasks
- `app/tasks/payment_tasks.py` - Payment tasks
- `app/tasks/media_tasks.py` - Media tasks
- `app/tasks/cleanup_tasks.py` - Cleanup tasks

### Workers

- `app/workers/celery_app.py` - Original Celery app
- `app/workers/celery_config.py` - Configuration (NEW)
- `app/workers/payout_tasks.py` - Payout tasks (existing)

---

## ✅ Checklist: Your First Celery Task

- [ ] Read [GETTING_STARTED.md](./GETTING_STARTED.md)
- [ ] Install Celery
- [ ] Set up Redis
- [ ] Start Celery worker
- [ ] Review [CODE_EXAMPLES.md](./CODE_EXAMPLES.md)
- [ ] Queue a task from endpoint
- [ ] Monitor execution with Flower
- [ ] Check result in Redis
- [ ] Verify database updates
- [ ] Review logs

---

## 📞 Need Help?

**"Where do I find..."**

- All tasks: [TASK_REFERENCE.md](./TASK_REFERENCE.md)
- Configuration: [CELERY_CONFIG.md](./CELERY_CONFIG.md)
- Examples: [CODE_EXAMPLES.md](./CODE_EXAMPLES.md)

**"How do I..."**

- Start the worker: [HOW_TO_RUN_WORKER.md](./HOW_TO_RUN_WORKER.md)
- Queue a task: [HOW_TO_QUEUE_TASK.md](./HOW_TO_QUEUE_TASK.md)
- Create a task: [HOW_TO_SCHEDULE_TASK.md](./HOW_TO_SCHEDULE_TASK.md)
- Monitor tasks: [HOW_TO_MONITOR.md](./HOW_TO_MONITOR.md)
- Debug issues: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

**"I have an issue..."**
→ Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 📊 Statistics

| Category            | Count | Status        |
| ------------------- | ----- | ------------- |
| Notification Tasks  | 5     | ✅ Templated  |
| Payment Tasks       | 4     | ✅ Templated  |
| Media Tasks         | 3     | ✅ Templated  |
| Cleanup Tasks       | 5     | ✅ Templated  |
| Scheduled Tasks     | 6     | ✅ Configured |
| Documentation Files | 14    | ✅ Complete   |

---

**Status**: ✅ Ready for Implementation  
**Last Updated**: March 26, 2026  
**Next**: [GETTING_STARTED.md](./GETTING_STARTED.md)
