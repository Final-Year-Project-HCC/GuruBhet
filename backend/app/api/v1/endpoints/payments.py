from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, DbSession
from app.core.enums import BookingStatus, TransactionReason, TransactionType, EsewaCallbackStatus
from app.core.exceptions import BookingNotFoundError
from app.core.socketio import get_socketio_manager
from app.models.booking import Booking
from app.models.payment import Transaction
from app.schemas.payment import (
    EsewaCallbackRequest,
    PayoutRead,
    TransactionRead,
)
from app.utils.esewa import verify_callback_signature

router = APIRouter()


@router.post("/esewa/callback")
async def esewa_payment_callback(
    body: EsewaCallbackRequest,
    db: DbSession,
    background_tasks: BackgroundTasks,
):
    """
    Called by the FRONTEND after eSewa redirects the student to the success URL.
    The frontend reads the eSewa params from the redirect URL and posts them here.

    1. Verifies the HMAC-SHA256 signature so we know the data is genuine.
    2. Idempotency: if the booking is already ACTIVE, return 200 silently.
    3. Creates an immutable Transaction ledger entry (BOOKING_ESCROW / DEBIT).
    4. Sets escrow_amount and flips booking to ACTIVE.
    5. Notifies the teacher via socket.

    This endpoint must be publicly accessible (no auth required).
    """
    # Step 1 — Verify the signature.
    # eSewa signs the response with HMAC-SHA256 using our secret key.
    # If someone fabricates a callback, this check will fail and we reject it.
    if not verify_callback_signature(body.model_dump()):
        raise HTTPException(status_code=400, detail="Invalid eSewa signature")

    # Step 2 — Load the booking with a row-level lock.
    # FOR UPDATE prevents two simultaneous callbacks from both activating the booking.
    result = await db.execute(
        select(Booking)
        .where(Booking.id == body.booking_id)
        .with_for_update()
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise BookingNotFoundError(booking_id=str(body.booking_id))

    # Step 3 — Idempotency guard.
    # If the booking is already ACTIVE (e.g. duplicate callback), do nothing.
    if booking.status == BookingStatus.ACTIVE:
        return {"message": "Already processed"}

    if booking.status != BookingStatus.PENDING_PAYMENT:
        raise HTTPException(
            status_code=400,
            detail=f"Booking is in status {booking.status.value}, cannot activate"
        )

    # Step 4 — Create an immutable ledger entry.
    # This records that the student's money has entered GuruBhet's account.
    # DEBIT from the student's perspective (money left their eSewa wallet).
    transaction = Transaction(
        user_id=booking.student_id,
        amount=booking.total_amount,
        type=TransactionType.DEBIT,
        reason=TransactionReason.BOOKING_ESCROW,
        booking_id=booking.id,
        esewa_ref_id=body.transaction_code,
        esewa_transaction_uuid=body.transaction_uuid,
        esewa_status=EsewaCallbackStatus.SUCCESS,
    )
    db.add(transaction)

    # Step 5 — Activate the booking.
    # escrow_amount tracks how much of the booking money is still held (not yet paid out to teacher).
    # It starts equal to total_amount and decreases as sessions are completed and paid out.
    booking.escrow_amount = booking.total_amount
    booking.status = BookingStatus.ACTIVE

    await db.commit()

    # Step 6 — Notify the teacher via socket so they see the booking go live in real time.
    sio_manager = get_socketio_manager()
    if sio_manager:
        background_tasks.add_task(
            sio_manager.emit_to_user,
            user_id=booking.teacher_id,
            event="booking_paid",
            data={"bookingId": str(booking.id)},
        )

    return {"message": "Payment verified and booking activated"}



@router.get("/transactions", response_model=list[TransactionRead])
async def my_transactions(current_user: CurrentUser, db: DbSession):
    """Return ledger entries for the current user."""
    ...


@router.get("/payouts", response_model=list[PayoutRead])
async def my_payouts(current_user: CurrentUser, db: DbSession):
    """Teacher: list their weekly payout history."""
    ...
