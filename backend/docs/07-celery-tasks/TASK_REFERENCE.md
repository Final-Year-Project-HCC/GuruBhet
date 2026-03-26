# 📋 Celery Task Reference

**Complete catalog of all available Celery tasks**

---

## 🔔 Notification Tasks (5 tasks)

**Location**: `app/tasks/notification_tasks.py`

### 1. `send_session_reminders`

**Purpose**: Send reminder notifications before session starts  
**Triggered**: Every 30 minutes (beat scheduler)  
**Parameters**: None  
**Retries**: 3

**Use Case**:

- Prevent no-shows by reminding users 2 hours before session
- Send to both teacher and student
- Include session details and LiveKit room link

**Implementation TODO**:

1. Query sessions starting in next 2 hours
2. Get teacher and student details
3. Send email via SMTP or third-party service
4. Send Socket.IO notification if user online
5. Return count of reminders sent

---

### 2. `check_session_no_shows`

**Purpose**: Detect and handle no-show sessions  
**Triggered**: Every 5 minutes (beat scheduler)  
**Parameters**: None  
**Retries**: 3

**Use Case**:

- Automatically mark sessions as NO_SHOW if not completed
- Update booking status to NO_SHOW
- Send notification to both users
- Trigger refund or rescheduling workflow

**Implementation TODO**:

1. Query sessions past their end_time
2. Check if session was completed
3. If not, mark as NO_SHOW in database
4. Update associated booking status
5. Send notifications to users
6. Log statistics

---

### 3. `send_booking_status_email`

**Purpose**: Send email when booking status changes  
**Triggered**: From endpoint when booking status updates  
**Parameters**:

- `user_id` (str): User to send email to
- `booking_id` (str): Associated booking
- `status` (str): New status (REQUESTED, APPROVED, REJECTED, PAID, COMPLETED)
  **Retries**: 3

**Example Usage**:

```python
send_booking_status_email.delay(
    user_id="student-123",
    booking_id="booking-456",
    status="APPROVED"
)
```

**Use Case**:

- Notify student when teacher approves booking
- Notify student when payment is received
- Notify teacher when booking is requested
- Send different templates based on status

---

### 4. `send_payment_receipt_email`

**Purpose**: Send detailed payment receipt after payment confirmation  
**Triggered**: From payment webhook handler  
**Parameters**:

- `user_id` (str): Student who paid
- `booking_id` (str): Associated booking
- `amount` (float): Amount paid
  **Retries**: 3

**Example Usage**:

```python
send_payment_receipt_email.delay(
    user_id="student-123",
    booking_id="booking-456",
    amount=500.00
)
```

**Use Case**:

- Send receipt with transaction details
- Include invoice (PDF optional)
- Provide session scheduling link
- Send to both student and teacher

---

### 5. `send_push_notification`

**Purpose**: Send push notification to mobile devices  
**Triggered**: From endpoints for real-time events (optional)  
**Parameters**:

- `user_id` (str): User to notify
- `title` (str): Notification title
- `body` (str): Notification body
- `data` (dict): Extra data (booking_id, session_id, etc.)
  **Retries**: 3

**Example Usage**:

```python
send_push_notification.delay(
    user_id="user-123",
    title="Session Starting Soon",
    body="Your session starts in 30 minutes",
    data={"session_id": "session-456", "action": "join_session"}
)
```

**Use Case**:

- Notify offline users
- Wake up sleeping devices
- Direct users to take action
- Works on iOS, Android via Firebase Cloud Messaging

---

## 💳 Payment Tasks (4 tasks)

**Location**: `app/tasks/payment_tasks.py`

### 1. `process_weekly_payouts`

**Purpose**: Process weekly payouts to teachers  
**Triggered**: Every Monday 12:00 AM (beat scheduler)  
**Parameters**: None  
**Retries**: 2 (critical task)

**Use Case**:

- Calculate teacher earnings for the week
- Deduct platform fee (10%)
- Transfer funds to teacher accounts
- Send payout confirmation to teachers
- Generate payout reports

**Workflow**:

1. Query completed sessions from last 7 days
2. Group by teacher
3. Calculate earnings: `session_fee - (session_fee * 0.10)`
4. Create payout record in database
5. Transfer funds to teacher eSewa account or bank
6. Send email to teacher with breakdown
7. Send Socket.IO notification to teacher dashboard
8. Update payment_account with transaction

**Implementation TODO**:

- Integrate with eSewa API for payouts
- Handle account suspension / payment failures
- Generate PDF payout reports
- Reconcile with accounting system

---

### 2. `retry_failed_payments`

**Purpose**: Retry failed payment verifications  
**Triggered**: Every hour (beat scheduler)  
**Parameters**: None  
**Retries**: 3

**Use Case**:

- Handle transient payment gateway failures
- Re-verify payments that couldn't be confirmed
- Update booking if payment actually succeeded
- Notify users of payment status

**Workflow**:

1. Query payments with status FAILED, retry_count < 3
2. For each failed payment, verify with eSewa API
3. If successful: Mark as PAID, activate booking, send emails
4. If still failed: Increment retry_count
5. If max retries exceeded: Notify user, suggest retry

---

### 3. `process_payment_webhook`

**Purpose**: Asynchronously process eSewa payment webhook  
**Triggered**: From payment webhook endpoint  
**Parameters**:

- `booking_id` (str): Associated booking
- `transaction_id` (str): eSewa transaction ID
- `amount` (float): Amount paid
  **Retries**: 3

**Example Usage**:

```python
# In webhook endpoint
@router.post("/payments/esewa-callback")
async def esewa_callback(payload: EsewaPayload):
    # Don't wait, queue the verification
    process_payment_webhook.delay(
        booking_id=str(payload.ref_id),
        transaction_id=str(payload.transaction_id),
        amount=float(payload.amount)
    )

    # Return immediately
    return {"status": "processing"}
```

**Use Case**:

- Non-blocking payment verification
- Prevent webhook timeout
- Handle heavy database updates asynchronously
- Send multiple notifications

---

### 4. `generate_invoice_pdf`

**Purpose**: Generate PDF invoice for completed session  
**Triggered**: After session completion (optional)  
**Parameters**:

- `booking_id` (str): Associated booking
- `user_id` (str): User to generate invoice for
  **Retries**: 2

**Example Usage**:

```python
generate_invoice_pdf.delay(
    booking_id="booking-456",
    user_id="student-123"
)
```

**Use Case**:

- Generate professional invoice PDF
- Include session details, teacher info, amount
- Store in S3 for long-term access
- Email to user
- Provide download link

---

## 📁 Media Tasks (3 tasks)

**Location**: `app/tasks/media_tasks.py`

### 1. `process_file_metadata`

**Purpose**: Extract and validate file metadata after upload  
**Triggered**: From file upload confirmation endpoint  
**Parameters**:

- `file_public_id` (str): Cloudinary public_id
- `user_id` (str): User who uploaded
  **Retries**: 2

**Example Usage**:

```python
process_file_metadata.delay(
    file_public_id="session-materials/abc123",
    user_id="teacher-456"
)
```

**Use Case**:

- Extract image dimensions, video duration, file size
- Generate thumbnail for previews
- Validate file integrity
- Update file_metadata database record

---

### 2. `generate_session_recording_summary`

**Purpose**: Create summary/highlights from session recording  
**Triggered**: After session recording completes  
**Parameters**:

- `session_id` (str): Associated session
- `recording_url` (str): URL of recording
  **Retries**: 2

**Example Usage**:

```python
generate_session_recording_summary.delay(
    session_id="session-789",
    recording_url="https://cloudinary.com/..."
)
```

**Use Case**:

- Extract keyframes for thumbnails
- Create highlight reel (optional)
- Generate transcript (optional)
- Notify user when ready

---

### 3. `compress_image`

**Purpose**: Compress and optimize image for web  
**Triggered**: After image upload (profile, session materials)  
**Parameters**:

- `file_public_id` (str): Cloudinary public_id
- `quality` (int): Target quality (default: 80)
  **Retries**: 2

**Example Usage**:

```python
compress_image.delay(
    file_public_id="avatars/user-123",
    quality=80
)
```

**Use Case**:

- Reduce file size for faster loading
- Generate multiple sizes (thumbnail, medium, full)
- Improve performance
- Save bandwidth

---

## 🧹 Cleanup Tasks (5 tasks)

**Location**: `app/tasks/cleanup_tasks.py`

### 1. `cleanup_old_notifications`

**Purpose**: Delete old notifications to keep database clean  
**Triggered**: Every day 3 AM (beat scheduler)  
**Parameters**: None  
**Retries**: 2

**Use Case**:

- Delete read notifications older than 30 days
- Delete unread notifications older than 90 days (safety)
- Keep important notifications (PAYMENT*\*, SESSION*\*) longer
- Reduce database size

---

### 2. `cleanup_unconfirmed_uploads`

**Purpose**: Delete unconfirmed file uploads from Cloudinary  
**Triggered**: Every hour (beat scheduler)  
**Parameters**: None  
**Retries**: 2

**Use Case**:

- Remove orphaned files (uploads not confirmed by user)
- Save Cloudinary storage quota
- Delete from both Cloudinary and database
- Run during off-hours

---

### 3. `archive_old_messages`

**Purpose**: Archive old chat messages for long-term storage  
**Triggered**: Every week (beat scheduler)  
**Parameters**: None  
**Retries**: 2

**Use Case**:

- Move messages older than 6 months to archive
- Keep database fast for active conversations
- Preserve history in S3
- Reduce PostgreSQL storage

---

### 4. `cleanup_expired_sessions`

**Purpose**: Mark expired sessions as inactive  
**Triggered**: Every 30 minutes (beat scheduler)  
**Parameters**: None  
**Retries**: 2

**Use Case**:

- Mark sessions past end_time as inactive
- Auto-detect and mark no-shows
- Update booking status if session not completed
- Send notifications

---

### 5. `cleanup_inactive_users`

**Purpose**: Process inactive user accounts  
**Triggered**: Monthly (beat scheduler)  
**Parameters**: None  
**Retries**: 2

**Use Case**:

- Email users inactive for 30 days (engagement)
- Archive accounts inactive for 1 year
- Delete obvious test/spam accounts
- Compliance and hygiene

---

## ⏰ Scheduled Tasks (Beat)

**Configuration**: `app/workers/celery_config.py`

```python
beat_schedule={
    "send-session-reminders": {
        "task": "app.tasks.notification_tasks.send_session_reminders",
        "schedule": 1800,  # Every 30 minutes
    },
    "check-session-no-shows": {
        "task": "app.tasks.notification_tasks.check_session_no_shows",
        "schedule": 300,  # Every 5 minutes
    },
    "process-weekly-payouts": {
        "task": "app.tasks.payout_tasks.process_weekly_payouts",
        "schedule": 604800,  # Every 7 days
    },
    # ... more tasks
}
```

---

## 📊 Task Summary

| Category          | Task                        | Frequency    | Status      |
| ----------------- | --------------------------- | ------------ | ----------- |
| **Notifications** | send_session_reminders      | Every 30 min | 🔔 Template |
|                   | check_session_no_shows      | Every 5 min  | 🔔 Template |
|                   | send_booking_status_email   | On demand    | 🔔 Template |
|                   | send_payment_receipt_email  | On demand    | 🔔 Template |
|                   | send_push_notification      | On demand    | 🔔 Template |
| **Payments**      | process_weekly_payouts      | Weekly       | 💳 Template |
|                   | retry_failed_payments       | Hourly       | 💳 Template |
|                   | process_payment_webhook     | On demand    | 💳 Template |
|                   | generate_invoice_pdf        | On demand    | 💳 Template |
| **Media**         | process_file_metadata       | On demand    | 📁 Template |
|                   | generate_recording_summary  | On demand    | 📁 Template |
|                   | compress_image              | On demand    | 📁 Template |
| **Cleanup**       | cleanup_old_notifications   | Daily        | 🧹 Template |
|                   | cleanup_unconfirmed_uploads | Hourly       | 🧹 Template |
|                   | archive_old_messages        | Weekly       | 🧹 Template |
|                   | cleanup_expired_sessions    | Every 30 min | 🧹 Template |
|                   | cleanup_inactive_users      | Monthly      | 🧹 Template |

---

## 🚀 How to Queue Tasks

### From Endpoint

```python
from app.tasks.notification_tasks import send_payment_receipt_email

@router.post("/payments/confirm")
async def confirm_payment(data: PaymentData):
    # Queue task (non-blocking)
    send_payment_receipt_email.delay(
        user_id=str(data.user_id),
        booking_id=str(data.booking_id),
        amount=data.amount
    )

    return {"status": "payment_confirmed"}
```

### From Service

```python
from app.tasks.payment_tasks import process_payment_webhook

class BookingService:
    @staticmethod
    async def confirm_payment(db, booking_id, amount):
        # Update database
        booking.payment_status = "PAID"

        # Queue async task
        process_payment_webhook.delay(
            booking_id=str(booking_id),
            transaction_id="txn-123",
            amount=amount
        )
```

---

## ✅ Implementation Checklist

- [ ] Install Celery: `poetry add celery`
- [ ] Set Redis URL in .env
- [ ] Start Celery worker: `celery -A app.workers.celery_config worker`
- [ ] Implement notification tasks (5 tasks)
- [ ] Implement payment tasks (4 tasks)
- [ ] Implement media tasks (3 tasks)
- [ ] Implement cleanup tasks (5 tasks)
- [ ] Test each task individually
- [ ] Monitor with Flower: `pip install flower`
- [ ] Deploy to production

---

**Status**: ✅ Tasks Defined and Templated  
**Next**: See [CODE_EXAMPLES.md](./CODE_EXAMPLES.md) for implementation examples
