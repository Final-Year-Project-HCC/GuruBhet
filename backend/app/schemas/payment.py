from uuid import UUID
from decimal import Decimal
from datetime import datetime

from app.core.enums import TransactionType, TransactionReason, PayoutStatus, EsewaCallbackStatus
from .base import SharedConfig


class EsewaPaymentInitResponse(SharedConfig):

    product_code: str
    amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    transaction_uuid: str
    success_url: str
    failure_url: str
    signed_field_names: str
    signature: str


class EsewaCallbackRequest(SharedConfig):

    booking_id: UUID
    transaction_code: str
    status: str
    total_amount: str
    transaction_uuid: str
    product_code: str
    signed_field_names: str
    signature: str


class TransactionRead(SharedConfig):

    id: UUID
    user_id: UUID
    amount: Decimal
    currency: str
    type: TransactionType
    reason: TransactionReason
    booking_id: UUID | None
    esewa_ref_id: str | None
    created_at: datetime


class PayoutRead(SharedConfig):

    id: UUID
    teacher_id: UUID
    period_start: datetime
    period_end: datetime
    gross_amount: Decimal
    platform_fee_amount: Decimal
    net_amount: Decimal
    status: PayoutStatus
    processed_at: datetime | None