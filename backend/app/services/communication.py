"""Service for managing messages and notifications.

Database-First Architecture:
  1. All communication (messages, notifications, requests) are FIRST saved to PostgreSQL.
  2. AFTER successful database persistence, real-time Socket.IO events are emitted.
  3. This ensures data durability even if the socket connection fails or is slow.
  4. Socket.IO emission is a best-effort operation; DB persistence is guaranteed.
"""
import json
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.communication import Message, Notification, MessageType, NotificationType
from app.schemas.communication import MessageCreate, NotificationRead

logger = logging.getLogger(__name__)


class CommunicationService:
    """Service for handling messages and notifications with Database-First persistence."""

    @staticmethod
    async def save_and_send_message(
        db: AsyncSession,
        sender_id: UUID,
        receiver_id: UUID,
        content: str,
        message_type: str = "TEXT",
        file_url: str | None = None,
        file_public_id: str | None = None,
        booking_id: UUID | None = None,
        session_id: UUID | None = None,
        socketio_manager=None,
    ) -> Message:
        """
        Save message to database FIRST, then emit Socket.IO event to receiver.
        
        Database-First Flow:
          1. Validate inputs
          2. Create Message object
          3. Persist to PostgreSQL database
          4. Flush to obtain message.id
          5. Emit real-time Socket.IO event (best-effort)
          6. Caller commits transaction
        
        Args:
            db: Database session
            sender_id: UUID of message sender
            receiver_id: UUID of message receiver
            content: Message content
            message_type: Type of message (TEXT, FILE)
            file_url: URL of attached file (if any)
            file_public_id: Cloudinary public_id for file deletion
            booking_id: Associated booking ID (context)
            session_id: Associated session ID (context)
            socketio_manager: SocketIO manager instance for real-time emission
        
        Returns:
            Created Message object with ID persisted in database
            
        Raises:
            ValueError: If validation fails (empty content, same sender/receiver)
        """
        # Step 1: Validate inputs
        if not content or not content.strip():
            raise ValueError("Message content cannot be empty")
        if sender_id == receiver_id:
            raise ValueError("Sender and receiver cannot be the same")
        
        try:
            # Step 2-3: Create and persist message to database
            message = Message(
                sender_id=sender_id,
                receiver_id=receiver_id,
                content=content.strip(),
                message_type=message_type,
                file_url=file_url,
                file_public_id=file_public_id,
                booking_id=booking_id,
                session_id=session_id,
                is_read=False,
            )
            
            db.add(message)
            await db.flush()  # Step 4: Flush to get the ID without committing
            
            logger.info(
                f"Message persisted to DB: id={message.id}, sender={sender_id}, "
                f"receiver={receiver_id}, type={message_type}"
            )
            
            # Step 5: Emit Socket.IO event to receiver (best-effort)
            if socketio_manager:
                try:
                    await socketio_manager.emit_to_user(
                        receiver_id,
                        "message_received",
                        {
                            "id": str(message.id),
                            "sender_id": str(sender_id),
                            "content": content,
                            "message_type": message_type,
                            "file_url": file_url,
                            "booking_id": str(booking_id) if booking_id else None,
                            "session_id": str(session_id) if session_id else None,
                            "created_at": message.created_at.isoformat() if message.created_at else None,
                        },
                    )
                    logger.debug(f"Socket.IO event emitted to user {receiver_id}")
                except Exception as e:
                    # Log the error but don't raise; message is safely in DB
                    logger.warning(
                        f"Failed to emit Socket.IO event to {receiver_id}: {e}. "
                        "Message is persisted in database."
                    )
            
            return message
        
        except Exception as e:
            logger.error(f"Error in save_and_send_message: {e}", exc_info=True)
            raise
        
        return message

    @staticmethod
    async def send_system_notification(
        db: AsyncSession,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        booking_id: UUID | None = None,
        session_id: UUID | None = None,
        sender_id: UUID | None = None,
        payload: dict | None = None,
        socketio_manager=None,
    ) -> Notification:
        """
        Send system notification to user.
        
        Args:
            db: Database session
            user_id: UUID of notification recipient
            notification_type: Type of notification (SESSION_INITIATED, BOOKING_APPROVED, etc.)
            title: Notification title
            message: Notification message
            booking_id: Associated booking ID
            session_id: Associated session ID
            sender_id: ID of user who triggered notification
            payload: Additional JSON payload
            socketio_manager: SocketIO manager instance for emitting events
        
        Returns:
            Created Notification object
        """
        if payload is None:
            payload = {}
        
        # Add context to payload
        payload.update({
            "booking_id": str(booking_id) if booking_id else None,
            "session_id": str(session_id) if session_id else None,
            "sender_id": str(sender_id) if sender_id else None,
        })
        
        # Create notification in database
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            booking_id=booking_id,
            session_id=session_id,
            sender_id=sender_id,
            payload=payload,
            is_read=False,
        )
        
        db.add(notification)
        await db.flush()  # Flush to get the ID without committing
        
        # Emit Socket.IO event to user
        if socketio_manager:
            await socketio_manager.emit_to_user(
                user_id,
                "new_notification",
                {
                    "id": str(notification.id),
                    "type": notification_type,
                    "title": title,
                    "message": message,
                    "booking_id": str(booking_id) if booking_id else None,
                    "session_id": str(session_id) if session_id else None,
                    "sender_id": str(sender_id) if sender_id else None,
                    "payload": payload,
                    "created_at": notification.created_at.isoformat(),
                },
            )
        
        return notification

    @staticmethod
    async def get_conversation(
        db: AsyncSession,
        user_id: UUID,
        other_user_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Message]:
        """
        Get message history between two users.
        
        Args:
            db: Database session
            user_id: Current user ID
            other_user_id: Other user ID
            limit: Maximum messages to return
            offset: Offset for pagination
        
        Returns:
            List of messages between the two users
        """
        query = select(Message).where(
            (
                (Message.sender_id == user_id) & (Message.receiver_id == other_user_id)
            )
            | (
                (Message.sender_id == other_user_id) & (Message.receiver_id == user_id)
            )
        ).order_by(desc(Message.created_at)).limit(limit).offset(offset)
        
        result = await db.execute(query)
        messages = result.scalars().all()
        
        # Reverse to get chronological order
        return list(reversed(messages))

    @staticmethod
    async def get_notifications(
        db: AsyncSession,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> list[Notification]:
        """
        Get notifications for a user.
        
        Args:
            db: Database session
            user_id: User ID
            limit: Maximum notifications to return
            offset: Offset for pagination
            unread_only: Only get unread notifications
        
        Returns:
            List of notifications
        """
        conditions = [Notification.user_id == user_id]
        
        if unread_only:
            conditions.append(Notification.is_read == False)  # noqa: E712
        
        query = (
            select(Notification)
            .where(and_(*conditions))
            .order_by(desc(Notification.created_at))
            .limit(limit)
            .offset(offset)
        )
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def mark_message_as_read(
        db: AsyncSession,
        message_id: UUID,
    ) -> Message:
        """Mark a message as read."""
        query = select(Message).where(Message.id == message_id)
        result = await db.execute(query)
        message = result.scalars().first()
        
        if message and not message.is_read:
            message.is_read = True
            message.read_at = datetime.utcnow()
            await db.flush()
        
        return message

    @staticmethod
    async def mark_notification_as_read(
        db: AsyncSession,
        notification_id: UUID,
    ) -> Notification:
        """Mark a notification as read."""
        query = select(Notification).where(Notification.id == notification_id)
        result = await db.execute(query)
        notification = result.scalars().first()
        
        if notification and not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            await db.flush()
        
        return notification

    @staticmethod
    async def get_conversations_list(
        db: AsyncSession,
        user_id: UUID,
    ) -> list[dict]:
        """
        Get list of conversations for a user.
        
        Returns conversations with last message preview and unread count.
        """
        # Get all unique users this user has messaged
        query = select(Message).where(
            (Message.sender_id == user_id) | (Message.receiver_id == user_id)
        ).order_by(desc(Message.created_at))
        
        result = await db.execute(query)
        all_messages = result.scalars().all()
        
        conversations = {}
        
        for msg in all_messages:
            # Determine other user
            other_user_id = msg.receiver_id if msg.sender_id == user_id else msg.sender_id
            
            if str(other_user_id) not in conversations:
                # Count unread messages from this user
                unread_query = select(Message).where(
                    (Message.sender_id == other_user_id)
                    & (Message.receiver_id == user_id)
                    & (Message.is_read == False)  # noqa: E712
                )
                unread_result = await db.execute(unread_query)
                unread_count = len(unread_result.scalars().all())
                
                conversations[str(other_user_id)] = {
                    "other_user_id": str(other_user_id),
                    "last_message": msg.content[:100],
                    "last_message_at": msg.created_at.isoformat(),
                    "unread_count": unread_count,
                }
        
        return list(conversations.values())
