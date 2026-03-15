from fastapi import APIRouter, Request
from app.core.dependencies import DbSession, CurrentUser
from app.schemas.payment import (
    EsewaCallbackRequest, TransactionRead, PayoutRead,
)

router = APIRouter()


@router.post("/esewa/callback")
async def esewa_payment_callback(request: Request, db: DbSession):
    """
    eSewa POSTs here after payment attempt (success or failure).
    Verifies HMAC signature, then:
      - On SUCCESS: activates the Booking, records BOOKING_ESCROW transaction.
      - On FAILURE: marks booking CANCELLED, no charge.
    This endpoint must be publicly accessible (no auth).
    """
    ...


@router.get("/transactions", response_model=list[TransactionRead])
async def my_transactions(current_user: CurrentUser, db: DbSession):
    """Return ledger entries for the current user."""
    ...


@router.get("/payouts", response_model=list[PayoutRead])
async def my_payouts(current_user: CurrentUser, db: DbSession):
    """Teacher: list their weekly payout history."""
    ...