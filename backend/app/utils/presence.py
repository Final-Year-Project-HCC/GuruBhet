"""Presence and online status utilities for real-time user tracking."""
import logging
from uuid import UUID
from typing import Optional

from app.core.socketio import get_socketio_manager
from app.db.redis import cache_set, cache_get, cache_delete

logger = logging.getLogger(__name__)


# ── Redis-based presence tracking (for distributed environments) ──────────────

async def set_user_online(user_id: UUID, ttl: int = 3600) -> None:
    """
    Mark a user as online in Redis.
    
    Args:
        user_id: User UUID
        ttl: Time to live in seconds (default 1 hour)
    
    This is used in distributed environments where Socket.IO Redis adapter
    syncs presence across multiple worker processes.
    """
    await cache_set(f"user_online:{user_id}", {"online": True}, ttl=ttl)
    logger.debug(f"User {user_id} marked online in Redis")


async def set_user_offline(user_id: UUID) -> None:
    """
    Mark a user as offline in Redis.
    
    Args:
        user_id: User UUID
    """
    await cache_delete(f"user_online:{user_id}")
    logger.debug(f"User {user_id} marked offline in Redis")


async def is_user_online_redis(user_id: UUID) -> bool:
    """
    Check if user is online via Redis.
    
    Args:
        user_id: User UUID
    
    Returns:
        True if user has an active online key in Redis
    
    Use this in distributed environments with multiple workers.
    """
    result = await cache_get(f"user_online:{user_id}")
    return result is not None


def is_user_online_local(user_id: UUID) -> bool:
    """
    Check if user is online via local Socket.IO manager.
    
    Args:
        user_id: User UUID
    
    Returns:
        True if user has active socket connections in this process
    
    Use this in single-process or testing environments.
    The Socket.IO manager tracks connections for THIS process only.
    """
    manager = get_socketio_manager()
    if not manager:
        logger.warning("Socket.IO manager not initialized")
        return False
    
    return manager.is_user_online(user_id)


async def is_user_online(user_id: UUID, use_redis: bool = False) -> bool:
    """
    Check if user is online using configured backend.
    
    Args:
        user_id: User UUID
        use_redis: If True, use Redis (distributed). If False, use local Socket.IO manager.
    
    Returns:
        True if user is online
    
    This is the unified presence check function. Use this in endpoints.
    In production, use_redis=True for multi-worker deployments.
    """
    if use_redis:
        return await is_user_online_redis(user_id)
    else:
        return is_user_online_local(user_id)


def get_user_socket_ids(user_id: UUID) -> set[str]:
    """
    Get all socket IDs for a user in this process.
    
    Args:
        user_id: User UUID
    
    Returns:
        Set of socket IDs (empty if user not online in this process)
    
    Note: In distributed environments, this only returns sockets in THIS process.
    Use this to get socket IDs for targeted messaging.
    """
    manager = get_socketio_manager()
    if not manager:
        return set()
    
    user_key = str(user_id)
    return manager.user_sessions.get(user_key, set()).copy()


def get_user_session_count(user_id: UUID) -> int:
    """Get number of active socket connections for a user."""
    manager = get_socketio_manager()
    if not manager:
        return 0
    
    return manager.get_user_session_count(user_id)


# ── Redis key management for session requests ──────────────────────────────────

async def set_session_request_pending(
    booking_id: UUID,
    teacher_id: UUID,
    student_id: UUID,
    ttl: int = 60
) -> None:
    """
    Mark a session request as pending (60-second window).
    
    Args:
        booking_id: Booking UUID
        teacher_id: Teacher's UUID
        student_id: Student's UUID
        ttl: Time to live in seconds (default 60)
    
    Stores metadata needed for expiration handling.
    """
    await cache_set(
        f"pending_session_request:{booking_id}",
        {
            "teacher_id": str(teacher_id),
            "student_id": str(student_id),
            "status": "PENDING",
        },
        ttl=ttl
    )
    logger.debug(f"Session request pending for booking {booking_id}, expires in {ttl}s")


async def get_session_request_pending(booking_id: UUID) -> dict | None:
    """
    Get pending session request metadata.
    
    Args:
        booking_id: Booking UUID
    
    Returns:
        Dict with teacher_id, student_id, status if pending, None if expired
    """
    return await cache_get(f"pending_session_request:{booking_id}")


async def clear_session_request_pending(booking_id: UUID) -> None:
    """
    Clear the pending session request (called when student accepts).
    
    Args:
        booking_id: Booking UUID
    """
    await cache_delete(f"pending_session_request:{booking_id}")
    logger.debug(f"Cleared pending session request for booking {booking_id}")


async def get_expired_session_requests() -> list[str]:
    """
    Get all expired session requests from Redis.
    
    Note: This is a best-effort check. Redis may not have notified us of
    all expirations yet. Use this for periodic cleanup or debugging.
    
    Returns:
        List of booking_id strings (may be empty if using keyspace notifications)
    """
    # In a production implementation, you would use Redis Keyspace Notifications
    # to get a list of expired keys. For now, return empty list as the
    # expiration handling is done via scheduled tasks or listener callbacks.
    return []
