"""Email and notification tasks for Celery."""
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.celery import celery_app
from app.models.user import User
from app.models.booking import Booking
from app.models.communication import Notification

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.notification_tasks.send_session_reminders",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_session_reminders(self):
    """
    Send email/notification reminders for upcoming sessions.
    
    Runs every 30 minutes to check for sessions starting in 2 hours
    and send reminders to both teacher and student.
    
    Use case: Prevent no-shows by reminding users before session starts
    """
    try:
        logger.info("Starting send_session_reminders task")
        
        # TODO: Implement logic to:
        # 1. Query sessions starting in next 2 hours (is_active=True, not yet started)
        # 2. Get teacher and student info
        # 3. Send email to both: "Your session starts in 2 hours"
        # 4. Send Socket.IO notification (if user is online)
        # 5. Return count of reminders sent
        
        return {
            "status": "success",
            "reminders_sent": 0,
            "message": "Session reminders sent"
        }
    except Exception as exc:
        logger.error(f"Error in send_session_reminders: {exc}", exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(
    name="app.tasks.notification_tasks.check_session_no_shows",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def check_session_no_shows(self):
    """
    Check for no-shows and take action.
    
    Runs every 5 minutes to check if sessions have passed without being marked
    as completed. If no activity detected, mark as no-show.
    
    Use case: Automatically detect no-shows and update booking status
    """
    try:
        logger.info("Starting check_session_no_shows task")
        
        # TODO: Implement logic to:
        # 1. Query sessions that should have ended (past end_time)
        # 2. Check if session was marked as completed
        # 3. If not completed, mark as NO_SHOW
        # 4. Send notification to both users about no-show
        # 5. Update booking status accordingly
        # 6. Return count of no-shows detected
        
        return {
            "status": "success",
            "no_shows_detected": 0,
            "message": "No-show check completed"
        }
    except Exception as exc:
        logger.error(f"Error in check_session_no_shows: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(
    name="app.tasks.notification_tasks.send_booking_status_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_booking_status_email(self, user_id: str, booking_id: str, status: str):
    """
    Send email when booking status changes.
    
    Called from booking endpoints when:
    - Student requests a booking
    - Teacher approves/rejects booking
    - Payment is received
    - Session is completed
    
    Use case: Non-blocking email sending that can retry if failed
    
    Args:
        user_id: User to send email to
        booking_id: Associated booking
        status: Booking status (REQUESTED, APPROVED, REJECTED, PAID, COMPLETED)
    """
    try:
        logger.info(f"Sending booking status email for {booking_id} status={status}")
        
        # TODO: Implement logic to:
        # 1. Get user email from user_id
        # 2. Get booking details
        # 3. Load email template for this status
        # 4. Send email via SMTP
        # 5. Log email sent
        
        return {
            "status": "success",
            "booking_id": booking_id,
            "user_id": user_id,
            "message": f"Email sent for booking status: {status}"
        }
    except Exception as exc:
        logger.error(f"Error sending booking email: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(
    name="app.tasks.notification_tasks.send_payment_receipt_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_payment_receipt_email(self, user_id: str, booking_id: str, amount: float):
    """
    Send payment receipt email.
    
    Called after eSewa payment confirmation.
    
    Use case: Send detailed receipt without blocking payment webhook
    
    Args:
        user_id: Student who made payment
        booking_id: Associated booking
        amount: Amount paid
    """
    try:
        logger.info(f"Sending payment receipt for booking {booking_id}")
        
        # TODO: Implement logic to:
        # 1. Get user email
        # 2. Get booking and teacher details
        # 3. Generate receipt PDF (optional)
        # 4. Send email with receipt attachment
        # 5. Log receipt sent
        
        return {
            "status": "success",
            "booking_id": booking_id,
            "amount": amount,
            "message": "Payment receipt email sent"
        }
    except Exception as exc:
        logger.error(f"Error sending payment receipt: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(
    name="app.tasks.notification_tasks.send_push_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_push_notification(self, user_id: str, title: str, body: str, data: dict = None):
    """
    Send push notification to mobile devices.
    
    Called when real-time event needs to notify offline users.
    
    Use case: Send push notification via FCM without blocking main request
    
    Args:
        user_id: User to notify
        title: Notification title
        body: Notification body
        data: Extra data (booking_id, session_id, etc.)
    """
    try:
        logger.info(f"Sending push notification to user {user_id}")
        
        # TODO: Implement logic to:
        # 1. Get user's FCM tokens from database
        # 2. Send push via Firebase Cloud Messaging (FCM)
        # 3. Handle multiple devices per user
        # 4. Track notification delivery
        # 5. Remove invalid tokens
        
        return {
            "status": "success",
            "user_id": user_id,
            "message": "Push notification sent"
        }
    except Exception as exc:
        logger.error(f"Error sending push notification: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(
    name="app.tasks.notification_tasks.send_session_complete_notification",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def send_session_complete_notification(self, session_id: str, booking_id: str):
    """
    Send completion notifications after a session ends.
    
    Called immediately after a session is marked COMPLETED.
    
    Use case:
    - Notify both teacher and student of completion
    - Send summary email with duration, rating prompt
    - Trigger rating request flow
    - Update user-facing session status
    
    Workflow:
    1. Get session and booking details
    2. Get teacher and student contact info
    3. Send completion email to both with:
       - Session duration
       - Rate link
       - Feedback form
    4. Send Socket.IO notification (real-time)
    5. Send push notification if offline
    6. Create activity log entry
    
    Args:
        session_id: Session UUID as string
        booking_id: Booking UUID as string
    """
    try:
        logger.info(f"Sending session complete notification for session {session_id}")
        
        # TODO: Implement async-safe database access in Celery context:
        # 1. Query session, booking, teacher, student
        # 2. Calculate duration from session.duration_seconds
        # 3. Build email context:
        #    - Duration: {minutes} minutes
        #    - Teacher: {teacher_name}
        #    - Student: {student_name}
        #    - Subject: {subject_name}
        #    - Rating link: /rate-session/{session_id}
        # 4. Send emails via Celery or mail service
        # 5. Emit Socket.IO "session_complete" event
        # 6. Create Notification records in DB
        # 7. Send push notifications if users are offline
        
        return {
            "status": "success",
            "session_id": session_id,
            "booking_id": booking_id,
            "message": "Session completion notifications sent",
        }
    except Exception as exc:
        logger.error(f"Error sending session complete notification: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)

import smtplib
from email.message import EmailMessage
from app.core.config import settings

@celery_app.task(
    name="app.tasks.notification_tasks.send_staff_invite_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_staff_invite_email(self, email_to: str, raw_token: str):
    """
    Sends an SMTP email with the staff invitation magic link.
    Runs asynchronously in the background via Celery.
    """
    try:
        msg = EmailMessage()
        msg["Subject"] = "You have been invited to join GuruBhet Staff"
        msg["From"] = getattr(settings, "EMAILS_FROM_EMAIL", "noreply@gurubhet.com")
        msg["To"] = email_to
        
        # Configurable frontend URL
        frontend_url = getattr(settings, "STAFF_FRONTEND_URL", "http://localhost:3000")
        invite_url = f"{frontend_url}/accept-invite?token={raw_token}"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <h2 style="color: #2c3e50;">Welcome to GuruBhet!</h2>
                <p>You have been invited to join the GuruBhet administrative staff team.</p>
                <p>Click the link below to securely set up your account, provide your details, and set a password:</p>
                <p>
                    <a href="{invite_url}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #3498db; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
                </p>
                <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                <p><em>{invite_url}</em></p>
                <p style="color: #7f8c8d; font-size: 0.9em;">This invitation will expire securely in 7 days.</p>
            </body>
        </html>
        """
        
        # Set plain text fallback, then HTML version
        msg.set_content(f"Please use a mail client that supports HTML.\\n\\nYour invite link is: {invite_url}")
        msg.add_alternative(html_content, subtype="html")
        
        # Send securely over TLS
        if settings.SMTP_HOST and settings.SMTP_USER:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Successfully sent staff invite email to {email_to}")
        else:
            logger.warning(f"SMTP credentials not configured! Mock sending invite email to {email_to}. Token: {raw_token}")
            
    except Exception as e:
        logger.error(f"Failed to send staff invite email to {email_to}: {e}")
        # Retry the task upon SMTP failures
        raise self.retry(exc=e)


@celery_app.task(
    name="app.tasks.notification_tasks.send_verification_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_verification_email(self, email_to: str, token: str):
    """
    Sends an SMTP email with the verification magic link.
    Runs asynchronously in the background via Celery.
    """
    try:
        msg = EmailMessage()
        msg["Subject"] = "Verify your Email Address - GuruBhet"
        msg["From"] = getattr(settings, "EMAILS_FROM_EMAIL", "noreply@gurubhet.com")
        msg["To"] = email_to
        
        # Determine the correct base URL based on environment or settings
        api_url = getattr(settings, "SERVER_HOST", "http://localhost:8000")
        verify_url = f"{api_url}/api/v1/auth/verify/{token}"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <h2 style="color: #2c3e50;">Welcome to GuruBhet!</h2>
                <p>Please verify your email address to unlock all features of your account.</p>
                <p>Click the link below to verify securely:</p>
                <p>
                    <a href="{verify_url}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #3498db; text-decoration: none; border-radius: 5px;">Verify Email</a>
                </p>
                <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                <p><em>{verify_url}</em></p>
                <p style="color: #7f8c8d; font-size: 0.9em;">This link will expire securely in 24 hours.</p>
            </body>
        </html>
        """
        
        msg.set_content(f"Please use a mail client that supports HTML.\\n\\nYour verification link is: {verify_url}")
        msg.add_alternative(html_content, subtype="html")
        
        if settings.SMTP_HOST and settings.SMTP_USER:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Successfully sent verification email to {email_to}")
        else:
            logger.warning(f"SMTP credentials not configured! Mock sending verification email to {email_to}. Token: {token}")
            
    except Exception as e:
        logger.error(f"Failed to send verification email to {email_to}: {e}")
        raise self.retry(exc=e)
