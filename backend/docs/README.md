# 📚 GuruBhet Backend - Documentation

Welcome to the GuruBhet backend documentation. This folder contains comprehensive guides for understanding and working with the backend architecture, features, and implementation details.

---

## 🎯 Quick Start for Developers

Choose based on what you want to work on:

### New to the Project?

1. Start with **[04-getting-started/](./04-getting-started/)** for setup and configuration
2. Read **[05-reference/](./05-reference/)** for architecture overview

### Working on a Specific Feature?

- **Video Sessions & LiveKit** → [03-video-sessions/](./03-video-sessions/)
- **Booking & Payments** → [02-booking-flow/](./02-booking-flow/)
- **Real-time Chat & Notifications** → [01-realtime-communication/](./01-realtime-communication/)
- **Async Tasks** → [00-task-allocation/](./00-task-allocation/) and [07-celery-tasks/](./07-celery-tasks/)
- **Task Strategy & Patterns** → [08-async-task-strategy/](./08-async-task-strategy/)
- **Secure Messaging** → [09-secure-messaging-architecture/](./09-secure-messaging-architecture/)

### Deployment & Infrastructure

- **Deployment Guides** → [06-deployment/](./06-deployment/)
- **Celery Setup** → [07-celery-tasks/](./07-celery-tasks/)

---

## 📂 Documentation Structure

### **00-task-allocation/**

Understanding BackgroundTasks vs Celery for async operations

- `CORRECT_TASK_ALLOCATION.md` - Which tasks use what
- `ACTION_PLAN_BACKGROUND_TASKS_VS_CELERY.md` - Implementation strategy
- `README.md` - Overview

### **01-realtime-communication/**

Socket.IO, WebSocket, chat, and real-time notifications

- `README_REALTIME.md` - Architecture overview
- `COMMUNICATION_MODULE.md` - Communication service details
- `CODE_EXAMPLES.md` - Implementation examples

### **02-booking-flow/**

Booking lifecycle, approval workflow, and payment integration

- `BOOKING_FLOW_UPDATED.md` - Current booking process
- `BOOKING_FLOW_DIAGRAM.md` - Visual flow diagrams
- `BOOKING_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `BOOKING_API_REFERENCE_UPDATED.md` - API endpoints and schemas

### **03-video-sessions/**

LiveKit integration, session management, and presence-aware features

- `00_START_HERE_PRESENCE_AWARE.md` - Entry point for presence features
- `README.md` - Session architecture overview
- `LIVEKIT_INTEGRATION.md` - LiveKit integration and workflow
- `LIVEKIT_API_REFERENCE.md` - LiveKit API reference
- `SESSION_LIFECYCLE_SYNC_ARCHITECTURE.md` - Session lifecycle and synchronization
- `SESSION_REQUEST_FLOW.md` - Session request workflow
- `SESSION_CREATION_REFACTORING.md` - Session creation details
- `PRESENCE_AWARE_SESSION_REQUESTS.md` - Presence checking implementation
- `SESSION_SYNC_CODE_EXAMPLES.md` - Code examples and patterns
- `QUICKREF_COPY_PASTE.md` - Quick reference for common tasks

### **04-getting-started/**

Setup, installation, and quick start guides

- `START_HERE.md` - Initial setup
- `QUICKSTART.md` - Quick start guide
- `MIGRATION_FIX.md` - Database migration information

### **05-reference/**

Technical architecture and implementation details

- Contains reference documentation for architecture and system design

### **06-deployment/**

Deployment procedures and operational guides

- Deployment documentation for production environments

### **07-celery-tasks/**

Celery task queue setup and configuration

- `README.md` - Celery setup overview
- `GETTING_STARTED.md` - Getting started with Celery
- `TASK_REFERENCE.md` - Task reference guide

### **08-async-task-strategy/**

Async patterns, strategies, and best practices

- `README.md` - Strategy overview
- `PATTERNS.md` - Common patterns
- `ENDPOINT_EXAMPLES.md` - Endpoint implementation examples
- `VISUAL_GUIDE.md` - Visual guide to patterns

### **09-secure-messaging-architecture/**

Secure messaging implementation

- `README.md` - Architecture overview
- `CODE_EXAMPLES.md` - Implementation examples
- `CLIENT_IMPLEMENTATION.md` - Client-side implementation
- `DIAGRAMS.md` - Architecture diagrams

---

## 🎓 Key Concepts

### BackgroundTasks (FastAPI Built-in)

Used for simple, lightweight operations:

- Token blacklist on logout
- Socket.IO event emissions
- Message read receipts
- Non-critical notifications

### Celery (Task Queue)

Used for complex, critical operations:

- Payment processing
- Weekly payouts
- Session cleanup
- Retry-able operations

---

## 🔍 Finding What You Need

| I want to...                  | Go to...                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Understand how booking works  | [02-booking-flow/](./02-booking-flow/)                                                |
| Set up LiveKit video sessions | [03-video-sessions/](./03-video-sessions/)                                            |
| Implement real-time features  | [01-realtime-communication/](./01-realtime-communication/)                            |
| Work with async tasks         | [00-task-allocation/](./00-task-allocation/) + [07-celery-tasks/](./07-celery-tasks/) |
| Learn the architecture        | [05-reference/](./05-reference/)                                                      |
| Deploy to production          | [06-deployment/](./06-deployment/)                                                    |

---

## 📝 Additional Resources

- **LIVEKIT_UNDERSTAND.md** ⭐ - **START HERE for LiveKit!** Complete understanding guide combining all LiveKit documentation (1000+ lines)
- **PRESENCE_AWARE_MASTER_GUIDE.md** - Complete guide for presence-aware session request features
- **CLEANUP_SUMMARY.md** - Documentation cleanup history and decisions
- **REMOVED_FILES_ARCHIVE.md** - List of removed documentation files

---

## ✨ Contributing to Documentation

When adding or updating documentation:

1. Keep it focused on developer needs
2. Remove status/completion reports periodically
3. Consolidate related documentation
4. Include code examples
5. Update the navigation in this README
