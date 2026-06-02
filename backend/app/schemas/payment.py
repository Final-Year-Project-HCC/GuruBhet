from uuid import UUID
from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from app.core.enums import TransactionType, TransactionReason, PayoutStatus, EsewaCallbackStatus
from .base import SharedConfig


class EsewaPaymentInitResponse(BaseModel):
    """eSewa checkout form params — must use snake_case keys, NOT camelCase.
    These field names are submitted verbatim as HTML form field names to eSewa.
    Do NOT inherit from SharedConfig (which adds camelCase alias_generator).
    """
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    product_code: str
    amount: str
    tax_amount: str
    product_service_charge: str
    product_delivery_charge: str
    total_amount: str
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