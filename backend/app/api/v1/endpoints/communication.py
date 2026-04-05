"""API endpoints for messages and communications.

This module implements the HTTP-to-Socket flow:
  1. POST /messages - HTTP endpoint to send a message
     - Validate JWT from Authorization header (copied from HttpOnly cookie by middleware)
     - Save message to PostgreSQL database
     - Emit real-time notification via Socket.IO
     - Return message ID to client
  
  2. POST /booking-requests - HTTP endpoint to send booking request
     - Validate JWT
     - Create booking request (or session request)
     - Save to database with status = PENDING
     - Emit notification to recipient
     - Return request ID and status
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.v1.endpoints.auth import get_current_user_id
from app.db.session import get_async_session
from app.models.communication import Message
from app.models.booking import Booking, Session as SessionModel, BookingStatus, SessionStatus
from app.models.user import User
from app.schemas.communication import MessageCreate, MessageResponse
from app.schemas.booking import BookingCreate, BookingResponse
from app.services.communication import CommunicationService, NotificationService
from app.core.socketio import socketio_manager
from app.core.exceptions import (
    ValidationError,
    UserNotFoundError,
    BookingNotFoundError,
    PermissionDeniedError,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ───────────────────────────────────────────────────────────────────────────────
# Message Endpoints
# ───────────────────────────────────────────────────────────────────────────────

@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_create: MessageCreate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
) -> MessageResponse:
    """
    Send a message from current user to a recipient.
    
    Database-First Flow:
      1. Validate request
      2. Verify recipient exists
      3. Save message to PostgreSQL
      4. Emit Socket.IO event to recipient
      5. Return 201 Created with message details
    
    Args:
        message_create: MessageCreate schema with receiver_id, content, etc.
        current_user_id: UUID of authenticated user (from JWT)
        db: Async database session
        
    Returns:
        MessageResponse with created message ID and timestamp
        
    Raises:
        HTTPException 400: If content is empty or validation fails
        HTTPException 404: If receiver doesn't exist
        HTTPException 401: If unauthorized
    """
    try:
        # Validate receiver exists and is not the same as sender
        if message_create.receiver_id == current_user_id:
            raise ValidationError(
                detail="Cannot send message to yourself",
                context={"receiver_id": str(message_create.receiver_id)}
            )
        
        result = await db.execute(
            select(User).where(User.id == message_create.receiver_id)
        )
        receiver = result.scalar_one_or_none()
        
        if not receiver:
            raise UserNotFoundError(user_id=str(message_create.receiver_id))
        
        # Save message to database (Database-First)
        message = await CommunicationService.save_and_send_message(
            db=db,
            sender_id=current_user_id,
            receiver_id=message_create.receiver_id,
            content=message_create.content,
            message_type=message_create.message_type or "TEXT",
            file_url=message_create.file_url,
            file_key=message_create.file_key,
            booking_id=message_create.booking_id,
            session_id=message_create.session_id,
            socketio_manager=socketio_manager,
        )
        
        # Commit transaction
        await db.commit()
        
        logger.info(f"Message {message.id} sent from {current_user_id} to {message_create.receiver_id}")
        
        return MessageResponse(
            id=message.id,
            sender_id=message.sender_id,
            receiver_id=message.receiver_id,
            content=message.content,
            message_type=message.message_type.value,
            file_url=message.file_url,
            booking_id=message.booking_id,
            session_id=message.session_id,
            is_read=message.is_read,
            created_at=message.created_at,
            read_at=message.read_at,
        )
    
    except ValidationError:
        raise
    except ValidationError as e:
        logger.warning(f"Validation error in send_message: {e}")
        raise ValidationError(
            detail=str(e),
            context={"error_type": "validation"}
        )
    except Exception as e:
        logger.error(f"Error sending message: {e}", exc_info=True)
        await db.rollback()
        raise ValidationError(
            detail="Failed to send message",
            context={"error_type": "unknown"}
        )


@router.get("/messages/{user_id}")
async def get_conversation(
    user_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    Retrieve conversation between current user and another user.
    
    Args:
        user_id: UUID of the conversation participant
        current_user_id: UUID of authenticated user
        db: Async database session
        limit: Number of messages to retrieve (default 50)
        offset: Pagination offset (default 0)
        
    Returns:
        dict with messages list and pagination info
    """
    try:
        result = await db.execute(
            select(Message)
            .where(
                (
                    ((Message.sender_id == current_user_id) & (Message.receiver_id == user_id))
                    | ((Message.sender_id == user_id) & (Message.receiver_id == current_user_id))
                )
            )
            .order_by(Message.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        messages = result.scalars().all()
        
        return {
            "messages": [
                MessageResponse(
                    id=msg.id,
                    sender_id=msg.sender_id,
                    receiver_id=msg.receiver_id,
                    content=msg.content,
                    message_type=msg.message_type.value,
                    file_url=msg.file_url,
                    booking_id=msg.booking_id,
                    session_id=msg.session_id,
                    is_read=msg.is_read,
                    created_at=msg.created_at,
                    read_at=msg.read_at,
                )
                for msg in reversed(messages)
            ],
            "total": len(messages),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        logger.error(f"Error retrieving conversation: {e}", exc_info=True)
        raise ValidationError(
            detail="Failed to retrieve conversation",
            context={"error_type": "database"}
        )


# ───────────────────────────────────────────────────────────────────────────────
# Booking Request Endpoints
# ───────────────────────────────────────────────────────────────────────────────

@router.post("/booking-requests", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_booking_request(
    booking_create: BookingCreate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
) -> dict:
    """
    Create a booking request (student requests teacher for sessions).
    
    Database-First Flow:
      1. Validate student and teacher exist
      2. Create Booking with status = PENDING_APPROVAL
      3. Persist to PostgreSQL
      4. Emit notification to teacher
      5. Return booking details
    
    Args:
        booking_create: BookingCreate schema
        current_user_id: UUID of authenticated user (student)
        db: Async database session
        
    Returns:
        dict with booking ID and status
        
    Raises:
        HTTPException 400: If validation fails
        HTTPException 404: If teacher or subject not found
    """
    try:
        # Verify teacher exists
        result = await db.execute(
            select(User).where(User.id == booking_create.teacher_id)
        )
        teacher = result.scalar_one_or_none()
        
        if not teacher:
            raise UserNotFoundError(user_id=str(booking_create.teacher_id))
        
        # Create booking with PENDING_APPROVAL status
        booking = Booking(
            student_id=current_user_id,
            teacher_id=booking_create.teacher_id,
            subject_id=booking_create.subject_id,
            total_sessions=booking_create.total_sessions,
            session_duration_minutes=booking_create.session_duration_minutes,
            rate_per_session=booking_create.rate_per_session,
            total_amount=booking_create.rate_per_session * booking_create.total_sessions,
            escrow_amount=booking_create.rate_per_session * booking_create.total_sessions,
            status=BookingStatus.PENDING_APPROVAL,
        )
        
        db.add(booking)
        await db.flush()
        
        logger.info(f"Booking {booking.id} created: student={current_user_id}, teacher={booking_create.teacher_id}")
        
        # Emit notification to teacher
        await NotificationService.create_and_emit_notification(
            db=db,
            user_id=booking_create.teacher_id,
            notification_type="BOOKING_REQUESTED",
            title="New Booking Request",
            message=f"You received a booking request for {booking_create.total_sessions} sessions",
            socketio_manager=socketio_manager,
            booking_id=booking.id,
            sender_id=current_user_id,
            payload={
                "total_sessions": booking_create.total_sessions,
                "rate_per_session": str(booking_create.rate_per_session),
                "total_amount": str(booking.total_amount),
            },
        )
        
        # Commit transaction
        await db.commit()
        
        return {
            "id": str(booking.id),
            "status": booking.status.value,
            "total_sessions": booking.total_sessions,
            "total_amount": str(booking.total_amount),
            "created_at": booking.created_at.isoformat() if booking.created_at else None,
        }
    
    except UserNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error creating booking request: {e}", exc_info=True)
        await db.rollback()
        raise ValidationError(
            detail="Failed to create booking request",
            context={"error_type": "database"}
        )


@router.post("/booking-requests/{booking_id}/approve", status_code=status.HTTP_200_OK)
async def approve_booking_request(
    booking_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
) -> dict:
    """
    Teacher approves a booking request.
    
    Database-First Flow:
      1. Verify booking exists and current user is the teacher
      2. Update booking status to PENDING_PAYMENT
      3. Persist change
      4. Emit notification to student
      5. Return updated booking status
    
    Args:
        booking_id: UUID of booking to approve
        current_user_id: UUID of authenticated user (teacher)
        db: Async database session
        
    Returns:
        dict with booking status and next steps
        
    Raises:
        HTTPException 404: If booking not found
        HTTPException 403: If not the teacher of this booking
    """
    try:
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        booking = result.scalar_one_or_none()
        
        if not booking:
            raise BookingNotFoundError(booking_id=str(booking_id))
        
        # Verify current user is the teacher
        if booking.teacher_id != current_user_id:
            raise PermissionDeniedError(
                detail="You are not authorized to approve this booking"
            )
        
        # Update status
        booking.status = BookingStatus.PENDING_PAYMENT
        booking.teacher_approved_at = logging.datetime.utcnow()
        
        await db.flush()
        
        # Emit notification to student
        await NotificationService.create_and_emit_notification(
            db=db,
            user_id=booking.student_id,
            notification_type="BOOKING_APPROVED",
            title="Booking Approved",
            message="Your booking request has been approved by the teacher",
            socketio_manager=socketio_manager,
            booking_id=booking.id,
            sender_id=current_user_id,
        )
        
        await db.commit()
        
        logger.info(f"Booking {booking_id} approved by teacher {current_user_id}")
        
        return {
            "id": str(booking.id),
            "status": booking.status.value,
            "message": "Booking approved. Please proceed with payment.",
        }
    
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Error approving booking: {e}", exc_info=True)
        await db.rollback()
        raise ValidationError(
            detail="Failed to approve booking",
            context={"error_type": "database"}
        )


@router.post("/booking-requests/{booking_id}/reject", status_code=status.HTTP_200_OK)
async def reject_booking_request(
    booking_id: UUID,
    rejection_reason: str,
    current_user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_session),
) -> dict:
    """
    Teacher rejects a booking request.
    
    Database-First Flow:
      1. Verify booking exists and current user is the teacher
      2. Update booking status to CANCELLED_BY_TEACHER
      3. Store rejection reason
      4. Emit notification to student
      5. Return rejection confirmation
    
    Args:
        booking_id: UUID of booking to reject
        rejection_reason: Reason for rejection
        current_user_id: UUID of authenticated user (teacher)
        db: Async database session
        
    Returns:
        dict with rejection confirmation
    """
    try:
        result = await db.execute(
            select(Booking).where(Booking.id == booking_id)
        )
        booking = result.scalar_one_or_none()
        
        if not booking:
            raise BookingNotFoundError(booking_id=str(booking_id))
        
        if booking.teacher_id != current_user_id:
            raise PermissionDeniedError(
                detail="You are not authorized to reject this booking"
            )
        
        # Update booking status
        booking.status = BookingStatus.CANCELLED_BY_TEACHER
        booking.cancellation_reason = rejection_reason
        booking.cancelled_at = logging.datetime.utcnow()
        
        await db.flush()
        
        # Emit notification to student
        await NotificationService.create_and_emit_notification(
            db=db,
            user_id=booking.student_id,
            notification_type="BOOKING_REJECTED",
            title="Booking Rejected",
            message=f"Your booking request was rejected. Reason: {rejection_reason}",
            socketio_manager=socketio_manager,
            booking_id=booking.id,
            sender_id=current_user_id,
        )
        
        await db.commit()
        
        logger.info(f"Booking {booking_id} rejected by teacher {current_user_id}")
        
        return {
            "id": str(booking.id),
            "status": booking.status.value,
            "message": "Booking rejected",
        }
    
    except BookingNotFoundError:
        raise
    except PermissionDeniedError:
        raise
    except Exception as e:
        logger.error(f"Error rejecting booking: {e}", exc_info=True)
        await db.rollback()
        raise ValidationError(
            detail="Failed to reject booking",
            context={"error_type": "database"}
        )
