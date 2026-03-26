from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.dependencies import DbSession, CurrentUser
from app.core.enums import BookingStatus, TransactionType, TransactionReason
from app.schemas.payment import (
    EsewaCallbackRequest, TransactionRead, PayoutRead,
)
from app.models.booking import Booking
from app.models.payment import Transaction

router = APIRouter()


@router.post("/esewa/callback")
async def esewa_payment_callback(request: Request, db: DbSession):
    """
    eSewa POSTs here after payment attempt (success or failure).
    Verifies HMAC signature, then:
      - On SUCCESS: activates the Booking (PENDING_PAYMENT → ACTIVE), records BOOKING_ESCROW transaction.
      - On FAILURE: marks booking CANCELLED, no charge.
    This endpoint must be publicly accessible (no auth).
    """
    # TODO: Implement eSewa callback verification and booking activation
    # For now, placeholder that shows the expected flow
    ...


@router.get("/transactions", response_model=list[TransactionRead])
async def my_transactions(current_user: CurrentUser, db: DbSession):
    """Return ledger entries for the current user."""
    ...


@router.get("/payouts", response_model=list[PayoutRead])
async def my_payouts(current_user: CurrentUser, db: DbSession):
    """Teacher: list their weekly payout history."""
    ...