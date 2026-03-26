"""Background tasks for session request handling and expiration."""
import logging
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, Session
from app.models.communication import Message, MessageType
from app.core.enums import BookingStatus, SessionStatus
from app.utils.presence import get_session_request_pending, clear_session_request_pending
from app.db.session import get_db_session

logger = logging.getLogger(__name__)


async def handle_session_request_expiration(booking_id: UUID) -> None:
    """
    Handle session request expiration after 60 seconds.
    
    Called when Redis key expires or via background scheduler.
    
    Steps:
    1. Check if session request still pending in Redis
    2. If expired:
       - Create notification message to student
       - Update booking status if needed
       - Log expiration event
    
    Args:
        booking_id: UUID of the booking with expired session request
    """
    logger.info(f"Processing session request expiration for booking {booking_id}")
    
    # Get pending request metadata from Redis
    pending = await get_session_request_pending(booking_id)
    if not pending:
        logger.debug(f"Session request for booking {booking_id} already cleared or expired")
        return
    
    teacher_id = UUID(pending["teacher_id"])
    student_id = UUID(pending["student_id"])
    
    try:
        # Get database session
        async with get_db_session() as db:
            # Fetch booking
            booking_result = await db.execute(
                select(Booking).where(Booking.id == booking_id)
            )
            booking = booking_result.scalar_one_or_none()
            
            if not booking:
                logger.warning(f"Booking {booking_id} not found during expiration handling")
                await clear_session_request_pending(booking_id)
                return
            
            # Create notification message to student
            expiration_message = Message(
                sender_id=teacher_id,
                receiver_id=student_id,
                content="Session request expired. Teacher did not receive your acceptance within 60 seconds.",
                message_type=MessageType.NOTIFICATION_TIMEOUT,
                booking_id=booking_id,
                is_read=False,
            )
            db.add(expiration_message)
            
            # Log the expiration event
            logger.info(
                f"Session request expired: booking={booking_id}, "
                f"teacher={teacher_id}, student={student_id}"
            )
            
            # Flush to database
            await db.flush()
            await db.commit()
            
            # Clear Redis key
            await clear_session_request_pending(booking_id)
            
            logger.info(f"Session request expiration handled for booking {booking_id}")
    
    except Exception as e:
        logger.error(f"Error handling session request expiration for booking {booking_id}: {e}")
        # Still clear the Redis key to avoid retry loops
        await clear_session_request_pending(booking_id)
        raise


async def create_session_request_message(
    booking_id: UUID,
    teacher_id: UUID,
    student_id: UUID,
    db: AsyncSession,
) -> Message:
    """
    Create a session request notification message.
    
    Args:
        booking_id: Booking UUID
        teacher_id: Teacher's UUID
        student_id: Student's UUID
        db: Database session
    
    Returns:
        Created Message object
    """
    message = Message(
        sender_id=teacher_id,
        receiver_id=student_id,
        content="Teacher has requested a session. You have 60 seconds to accept.",
        message_type=MessageType.SESSION_REQUEST,
        booking_id=booking_id,
        is_read=False,
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
    
    Args:
        booking_id: Booking UUID
        teacher_id: Teacher's UUID
        student_id: Student's UUID
        db: Database session
    
    Returns:
        Created Message object
    """
    message = Message(
        sender_id=teacher_id,
        receiver_id=student_id,
        content="Session request failed: You are currently offline. Please go online and try again.",
        message_type=MessageType.NOTIFICATION_ERROR,
        booking_id=booking_id,
        is_read=False,
    )
    db.add(message)
    await db.flush()
    return message


async def create_acceptance_notification_message(
    booking_id: UUID,
    teacher_id: UUID,
    student_id: UUID,
    session_id: UUID,
    db: AsyncSession,
) -> Message:
    """
    Create a notification message indicating student accepted.
    
    Args:
        booking_id: Booking UUID
        teacher_id: Teacher's UUID
        student_id: Student's UUID
        session_id: Session UUID
        db: Database session
    
    Returns:
        Created Message object
    """
    message = Message(
        sender_id=student_id,
        receiver_id=teacher_id,
        content="Student has accepted the session request. Session is ready to start.",
        message_type=MessageType.NOTIFICATION_ACCEPTED,
        booking_id=booking_id,
        session_id=session_id,
        is_read=False,
    )
    db.add(message)
    await db.flush()
    return message
