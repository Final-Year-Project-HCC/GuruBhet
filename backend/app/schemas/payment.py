from uuid import UUID
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.core.enums import TransactionType, TransactionReason, PayoutStatus, EsewaCallbackStatus


class EsewaPaymentInitResponse(BaseModel):
    """Returned to frontend to redirect the user to eSewa."""
    product_code: str
    amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    transaction_uuid: str
    success_url: str
    failure_url: str
    signed_field_names: str
    signature: str


class EsewaCallbackRequest(BaseModel):
    """eSewa POSTs this to our callback URL after payment."""
    transaction_code: str
    status: str
    total_amount: str
    transaction_uuid: str
    product_code: str
    signed_field_names: str
    signature: str


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    amount: Decimal
    currency: str
    type: TransactionType
    reason: TransactionReason
    booking_id: UUID | None
    esewa_ref_id: str | None
    created_at: datetime


class PayoutRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    teacher_id: UUID
    period_start: datetime
    period_end: datetime
    gross_amount: Decimal
    platform_fee_amount: Decimal
    net_amount: Decimal
    status: PayoutStatus
    processed_at: datetime | None