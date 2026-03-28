"""Background tasks for session request handling and expiration."""
import asyncio
import logging
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, Session
from app.models.communication import Message, MessageType, MessageStatus
from app.core.enums import BookingStatus, SessionStatus
from app.utils.presence import get_session_request_pending, clear_session_request_pending
from app.db.session import get_db_session
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


async def handle_session_request_expiration(booking_id: UUID, message_id: UUID) -> None:
    """
    Handle session request expiration after 60 seconds.
    
    Called by Celery task scheduled at 60-second countdown.
    Checks the message status in the database to determine final outcome:
    - If status is ONGOING → mark as MISSED (most recent interaction < 60s)
    - If status is ACCEPTED or REJECTED → no action needed (user already acted)
    
    Cases handled:
    1. PENDING_OFFLINE: Student offline when request was made (created before this task scheduled)
    2. ONGOING → ACCEPTED: Student accepted within 60s (cleared before this task ran)
    3. ONGOING → REJECTED: Student rejected within 60s (cleared before this task ran)
    4. ONGOING → MISSED: Student didn't respond within 60s (no action taken)
    
    Args:
        booking_id: UUID of the booking with session request
        message_id: UUID of the session request message
    """
    logger.info(f"Processing session request expiration for booking {booking_id}, message {message_id}")
    
    try:
        # Get database session
        async with get_db_session() as db:
            # Fetch the session request message
            message_result = await db.execute(
                select(Message).where(
                    Message.id == message_id,
                    Message.message_type == MessageType.SESSION_REQUEST
                )
            )
            message = message_result.scalar_one_or_none()
            
            if not message:
                logger.warning(f"Session request message {message_id} not found during expiration handling")
                return
            
            # Check current message status
            # If still ONGOING after 60s, mark as MISSED
            if message.status == MessageStatus.ONGOING:
                logger.info(
                    f"Session request expired (MISSED): booking={booking_id}, "
                    f"message={message_id}, student={message.receiver_id}"
                )
                
                # Update message status to MISSED
                message.status = MessageStatus.MISSED
                await db.commit()
                
                # Emit Socket.IO event to both teacher and student
                from app.core.socketio import get_socketio_manager
                sio_manager = get_socketio_manager()
                if sio_manager:
                    payload = {
                        "booking_id": str(booking_id),
                        "message_id": str(message_id),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }

                    await sio_manager.emit_to_user(
                        user_id=message.sender_id,
                        event="session_missed",
                        data=payload,
                    )
                    await sio_manager.emit_to_user(
                        user_id=message.receiver_id,
                        event="session_missed",
                        data=payload,
                    )
            else:
                logger.debug(
                    f"Session request already handled: booking={booking_id}, "
                    f"message={message_id}, status={message.status.value}"
                )
    
    except Exception as e:
        logger.error(f"Error handling session request expiration for message {message_id}: {e}")
        raise


async def create_session_request_message(
    booking_id: UUID,
    teacher_id: UUID,
    student_id: UUID,
    db: AsyncSession,
) -> Message:
    """
    Create a session request notification message.
    
    Sets initial status to ONGOING, which will be updated to:
    - ACCEPTED if student accepts within 60s
    - REJECTED if student rejects within 60s
    - MISSED if 60s timeout occurs with no action
    
    Args:
        booking_id: Booking UUID
        teacher_id: Teacher's UUID
        student_id: Student's UUID
        db: Database session
    
    Returns:
        Created Message object with status = ONGOING
    """
    message = Message(
        sender_id=teacher_id,
        receiver_id=student_id,
        content="Teacher has requested a session. You have 60 seconds to accept or reject.",
        message_type=MessageType.SESSION_REQUEST,
        booking_id=booking_id,
        is_read=False,
        status=MessageStatus.ONGOING,  # Case 2-4 initial state
    )
    db.add(message)
    await db.flush()
    return message


async def create_offline_notification_message(
    booking_id: UUID,
    teacher_id: UUID,
    student_id: UUID,
    db: AsyncSession,
) -> Message:
    """
    Create a notification message indicating student is offline.
    
    Case 1: Student is offline when teacher attempts to request session.
    Message status is set to PENDING_OFFLINE to indicate this specific case.
    
    Args:
        booking_id: Booking UUID
        teacher_id: Teacher's UUID
        student_id: Student's UUID
        db: Database session
    
    Returns:
        Created Message object with status = PENDING_OFFLINE
    """
    message = Message(
        sender_id=teacher_id,
        receiver_id=student_id,
        content="Session request failed: You are currently offline. Please go online and try again.",
        message_type=MessageType.SESSION_REQUEST,
        booking_id=booking_id,
        is_read=False,
        status=MessageStatus.PENDING_OFFLINE,  # Case 1: student was offline
    )
    db.add(message)
    await db.flush()
    return message

@celery_app.task(name="app.tasks.session_request_tasks.handle_session_request_timeout", bind=True, max_retries=2)
def handle_session_request_timeout_task(self, booking_id: str, message_id: str):
    """
    Celery task wrapper for handling session request timeouts.
    
    Checks message status after 60-second countdown:
    - If status is ONGOING → mark as MISSED
    - Otherwise → no action (user already responded)
    
    Args:
        booking_id: String UUID of the booking
        message_id: String UUID of the session request message
    """
    try:
        asyncio.run(
            handle_session_request_expiration(
                booking_id=UUID(booking_id),
                message_id=UUID(message_id)
            )
        )
    except Exception as exc:
        logger.error(f"Session request timeout task failed: {exc}")
        raise self.retry(exc=exc, countdown=5)  # Retry after 5 seconds

