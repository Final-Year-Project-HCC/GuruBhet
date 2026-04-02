"""
LiveKit integration utilities.

Rooms are named: session-{session_id}
Participants are identified by: user-{user_id}

Grants:
  - Both teacher and student: canPublish=True, canSubscribe=True
  - Whiteboard sync via LiveKit DataChannels (no extra infrastructure needed)
  - Screen share: canPublishSources includes SCREEN_SHARE
  - File share: handled via DataChannel messages with S3 pre-signed URLs
"""
import json
from livekit import api
from app.core.config import settings
from app.db.redis import cache_set, cache_get, cache_delete


# ── Singleton LiveKit API client ──────────────────────────────────────────────
# Initialised once at app startup via init_livekit() called from main.py lifespan.
# All functions share this single instance and its underlying HTTP connection pool.
 
_livekit_api: api.LiveKitAPI | None = None

async def init_livekit() -> None:
    """Called once at app startup to initialise the LiveKit API client."""
    global _livekit_api
    _livekit_api = api.LiveKitAPI(
        settings.LIVEKIT_URL,
        settings.LIVEKIT_API_KEY,
        settings.LIVEKIT_API_SECRET,
        use_ssl=False,
    )
async def close_livekit() -> None:
    """Called once at app shutdown to cleanly close the HTTP client."""
    global _livekit_api
    if _livekit_api:
        await _livekit_api.aclose()
        _livekit_api = None


def get_livekit_api() -> api.LiveKitAPI:
    if _livekit_api is None:
        raise RuntimeError("LiveKit API client not initialised. Call init_livekit() first.")
    return _livekit_api


# ── Token generation ──────────────────────────────────────────────────────────
 
def generate_room_token(
    user_id: str,
    session_id: str,
    display_name: str,
    is_teacher: bool = False,
) -> str:
    """
    Generate a signed LiveKit JWT for a participant.
    Grants video, audio, screen share, and data channels.
    Token generation is synchronous and does not use the API client.
    """
    room_name = f"session-{session_id}"
 
    grants = api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        can_update_own_metadata=True,
        hidden=False,
    )
 
    return (
        api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(f"user-{user_id}")
        .with_name(display_name)
        .with_grants(grants)
        .with_metadata(json.dumps({"is_teacher": is_teacher}))
        .to_jwt()
    )
 
 
# ── Room management ───────────────────────────────────────────────────────────
 
async def create_room(session_id: str, session_duration_minutes: int) -> str:
    """Create a LiveKit room for a session. Returns the room name.
    
    Lifecycle:
    1. Room is created with empty_timeout = 24 hours (fallback only)
    2. Celery cleanup task is scheduled to run at (duration + leniency) minutes
    3. Task calls end_room() which deletes the room and emits "room_finished"
    4. If Celery fails, room auto-closes after 24 hours as safety net
    
    The empty_timeout does NOT compete with the scheduled task - it only
    activates if the room becomes empty AND Celery hasn't cleaned it up yet.
    
    Args:
        session_id: UUID of the session
        session_duration_minutes: Duration of the session in minutes
    
    Returns:
        The room name (format: session-{session_id})
    """
    room_name = f"session-{session_id}"
    
    # Use 24-hour empty_timeout as fallback
    # Celery scheduled task is the primary controller of room lifecycle
    await get_livekit_api().room.create_room(
        api.CreateRoomRequest(
            name=room_name,
            empty_timeout=settings.LIVEKIT_EMPTY_TIMEOUT_SECONDS,
            max_participants=2,
        )
    )
    return room_name
 
 
async def end_room(room_name: str) -> None:
    """Delete a LiveKit room, disconnecting all participants.
    
    This is idempotent - if the room doesn't exist, it's a no-op.
    Handles cases where:
    - Room was already deleted by another process
    - Room name is invalid or empty
    - LiveKit API is unreachable (non-fatal)
    """
    if not room_name:
        return
    
    try:
        await get_livekit_api().room.delete_room(
            api.DeleteRoomRequest(room=room_name)
        )
    except Exception as exc:
        # Log but don't raise - room deletion is best-effort
        # Rooms auto-expire after empty_timeout anyway
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            f"Failed to delete LiveKit room '{room_name}': {exc}",
            extra={"room_name": room_name},
        )


# ── Session completion handler ────────────────────────────────────────────────

async def handle_session_completion(
    session,
    booking,
    db,
    completion_status,
) -> None:
    """
    Handle all common session completion logic.
    
    This is the single source of truth for what happens when a session ends.
    Called by:
    - Routes: request_session_completion, accept_session_completion, cancel_session
    - Celery: cleanup_expired_livekit_room
    - Webhook: room_finished (safety net only)
    
    Business Logic:
    1. Mark session with completion_status (COMPLETED, CANCELLED_BY_TEACHER, CANCELLED_BY_STUDENT)
    2. Record actual_end_at timestamp
    3. Create transaction (only for COMPLETED and CANCELLED_BY_STUDENT)
    4. Update booking counters (for all statuses)
    5. Increment teacher experience (for all statuses)
    6. Emit Socket.IO events
    7. Schedule post-session Celery tasks (only for COMPLETED)
    8. Delete the LiveKit room
    
    Args:
        session: The Session object to complete
        booking: The associated Booking object
        db: Database session for persistence
        completion_status: Why the session ended (COMPLETED, CANCELLED_BY_*)
    """
    import logging
    from datetime import datetime, timezone
    from uuid import UUID
    
    from app.core.enums import SessionStatus, TransactionType, TransactionReason, BookingStatus
    from app.models.payment import Transaction
    from app.repositories.teacher_subject_repo import TeacherSubjectRepository
    from app.core.socketio import get_socketio_manager
    
    logger = logging.getLogger(__name__)
    now = datetime.now(tz=timezone.utc)
    
    try:
        # ── 1. Set session status and actual end time ──
        session.status = completion_status
        if not session.actual_end_at:
            session.actual_end_at = now
        await db.flush()
        
        # ── 2. Create transaction (if applicable) ──
        # Credit teacher for:
        # - COMPLETED: They did the work
        # - CANCELLED_BY_STUDENT: They reserved their time (student penalty)
        # Do NOT credit for:
        # - CANCELLED_BY_TEACHER: Teacher cancelled (their penalty)
        if completion_status in (SessionStatus.COMPLETED, SessionStatus.CANCELLED_BY_STUDENT):
            db.add(Transaction(
                user_id=booking.teacher_id,
                amount=booking.rate_per_session,
                type=TransactionType.CREDIT,
                reason=TransactionReason.SESSION_RELEASE,
                booking_id=booking.id,
            ))
            await db.flush()
            logger.info(
                f"Transaction created for session {session.id}",
                extra={
                    "session_id": str(session.id),
                    "teacher_id": str(booking.teacher_id),
                    "amount": booking.rate_per_session,
                    "status": completion_status.value,
                }
            )
        
        # ── 3. Update booking counters (for all completion types) ──
        booking.completed_sessions += 1
        if booking.completed_sessions >= booking.total_sessions:
            booking.status = BookingStatus.COMPLETED
        await db.flush()
        
        # ── 4. Increment teacher experience (for all completion types) ──
        ts_repo = TeacherSubjectRepository(db)
        await ts_repo.increment_completed_sessions(
            teacher_id=booking.teacher_id,
            subject_id=booking.subject_id,
        )
        logger.info(
            f"Teacher experience incremented for session {session.id}",
            extra={
                "session_id": str(session.id),
                "teacher_id": str(booking.teacher_id),
            }
        )
        
        # ── 5. Commit all database changes BEFORE async operations ──
        await db.commit()
        logger.info(
            f"Session completion committed to database",
            extra={
                "session_id": str(session.id),
                "status": completion_status.value,
            }
        )
        
        # ── 6. Emit Socket.IO events (safe to fail) ──
        try:
            sio_manager = get_socketio_manager()
            if sio_manager:
                event_data = {
                    "session_id": str(session.id),
                    "status": completion_status.value,
                }
                
                await sio_manager.emit_to_user(
                    user_id=str(booking.student_id),
                    event="session_finished",
                    data=event_data,
                )
                await sio_manager.emit_to_user(
                    user_id=str(booking.teacher_id),
                    event="session_finished",
                    data=event_data,
                )
                logger.debug(
                    f"Socket.IO events emitted for session {session.id}",
                    extra={"session_id": str(session.id)}
                )
        except Exception as exc:
            logger.warning(
                f"Failed to emit Socket.IO events for session {session.id}: {exc}",
                extra={"session_id": str(session.id)},
                exc_info=True,
            )
            # Don't raise - Socket.IO failure shouldn't affect session completion
        
        # ── 7. Schedule post-session tasks (only for COMPLETED) ──
        if completion_status == SessionStatus.COMPLETED:
            try:
                from app.tasks.payment_tasks import process_session_billing
                from app.tasks.notification_tasks import send_session_complete_notification
                
                process_session_billing.delay(str(session.id), str(booking.id))
                send_session_complete_notification.delay(str(session.id), str(booking.id))
                logger.debug(
                    f"Post-session tasks scheduled for session {session.id}",
                    extra={"session_id": str(session.id)}
                )
            except Exception as exc:
                logger.warning(
                    f"Failed to schedule post-session tasks for session {session.id}: {exc}",
                    extra={"session_id": str(session.id)},
                    exc_info=True,
                )
                # Don't raise - Celery failure shouldn't affect session completion
        
        # ── 8. Delete the LiveKit room ──
        if session.livekit_room_name:
            try:
                await end_room(session.livekit_room_name)
                logger.debug(
                    f"LiveKit room deleted for session {session.id}",
                    extra={
                        "session_id": str(session.id),
                        "room_name": session.livekit_room_name,
                    }
                )
            except Exception as exc:
                logger.warning(
                    f"Failed to delete LiveKit room for session {session.id}: {exc}",
                    extra={"session_id": str(session.id)},
                    exc_info=True,
                )
                # Don't raise - room deletion is best-effort, room will auto-expire
        
        logger.info(
            f"✅ Session completion handler completed successfully",
            extra={
                "session_id": str(session.id),
                "status": completion_status.value,
            }
        )
        
    except Exception as exc:
        await db.rollback()
        logger.error(
            f"❌ Error in session completion handler: {exc}",
            extra={"session_id": str(session.id)},
            exc_info=True,
        )
        raise


# ── Redis-backed handshake & sync ─────────────────────────────────────────────


async def set_pending_session_key(booking_id: str, ttl: int = 60) -> None:
    """
    Set a Redis key indicating a session is pending student acceptance.
    
    Used to track the 60-second handshake window.
    Key format: pending_session:{booking_id}
    TTL: 60 seconds (expires automatically if not accepted)
    """
    await cache_set(f"pending_session:{booking_id}", {"status": "pending"}, ttl=ttl)


async def get_pending_session_key(booking_id: str) -> dict | None:
    """
    Retrieve pending session info from Redis.
    
    Returns {"session_id": "..."} if exists, None if expired or not found.
    """
    return await cache_get(f"pending_session:{booking_id}")


async def clear_pending_session_key(booking_id: str) -> None:
    """Clear the pending session key after student accepts."""
    await cache_delete(f"pending_session:{booking_id}")
