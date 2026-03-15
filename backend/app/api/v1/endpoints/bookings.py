from uuid import UUID
from fastapi import APIRouter
from app.core.dependencies import DbSession, CurrentUser
from app.schemas.booking import BookingCreate, BookingRead, BookingCancelRequest, LiveKitTokenResponse
from app.schemas.payment import EsewaPaymentInitResponse

router = APIRouter()


@router.post("/", response_model=EsewaPaymentInitResponse, status_code=201)
async def create_booking(body: BookingCreate, current_user: CurrentUser, db: DbSession):
    """
    Student creates a booking.
    Returns eSewa payment params — frontend redirects user to eSewa to complete payment.
    On success, eSewa POSTs to /payments/esewa/callback which activates the booking.
    """
    ...


@router.get("/", response_model=list[BookingRead])
async def list_my_bookings(current_user: CurrentUser, db: DbSession):
    """List bookings for the current user (student or teacher view)."""
    ...


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(booking_id: UUID, current_user: CurrentUser, db: DbSession):
    ...


@router.post("/{booking_id}/cancel", response_model=BookingRead)
async def cancel_booking(booking_id: UUID, body: BookingCancelRequest, current_user: CurrentUser, db: DbSession):
    """
    Cancel a booking.
    Triggers refund calculation for uncompleted sessions → queues refund Celery task.
    """
    ...