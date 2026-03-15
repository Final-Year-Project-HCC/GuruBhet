"""
eSewa v2 integration.

Payment flow:
  1. Backend generates signed payment params → returns to frontend.
  2. Frontend redirects user to eSewa checkout page.
  3. eSewa POSTs to /payments/esewa/callback with signed response.
  4. Backend verifies HMAC-SHA256 signature → activates Booking.

Refund flow:
  - GuruBhet holds funds in its own eSewa account.
  - Refund = GuruBhet initiates a transfer back to student's eSewa phone.

Payout flow:
  - GuruBhet initiates a transfer to teacher's eSewa phone weekly.
"""
import hashlib
import hmac
import base64
import uuid
from decimal import Decimal

import httpx

from app.core.config import settings


def _sign(message: str) -> str:
    key = settings.ESEWA_SECRET_KEY.encode()
    msg = message.encode()
    digest = hmac.new(key, msg, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def generate_payment_params(amount: Decimal, booking_id: str) -> dict:
    tax = Decimal("0.00")
    total = amount + tax
    transaction_uuid = str(uuid.uuid4())
    signed_fields = "total_amount,transaction_uuid,product_code"
    message = f"total_amount={total},transaction_uuid={transaction_uuid},product_code={settings.ESEWA_MERCHANT_CODE}"

    return {
        "product_code": settings.ESEWA_MERCHANT_CODE,
        "amount": str(amount),
        "tax_amount": str(tax),
        "total_amount": str(total),
        "transaction_uuid": transaction_uuid,
        "success_url": f"https://gurubhet.com/payment/success?booking_id={booking_id}",
        "failure_url": f"https://gurubhet.com/payment/failure?booking_id={booking_id}",
        "signed_field_names": signed_fields,
        "signature": _sign(message),
    }


def verify_callback_signature(data: dict) -> bool:
    fields = data.get("signed_field_names", "").split(",")
    message = ",".join(f"{f}={data[f]}" for f in fields if f in data)
    expected = _sign(message)
    return hmac.compare_digest(expected, data.get("signature", ""))


async def initiate_transfer(to_phone: str, amount: Decimal, remarks: str) -> dict:
    """
    Transfer money from GuruBhet's eSewa account to a recipient.
    Used for both refunds and teacher payouts.
    Returns eSewa's response dict.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.ESEWA_BASE_URL}/api/epay/merchant-api/payment",
            json={
                "merchantCode": settings.ESEWA_MERCHANT_CODE,
                "amount": str(amount),
                "remarks": remarks,
                "toMobileNo": to_phone,
            },
            headers={"Authorization": f"Bearer {settings.ESEWA_SECRET_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()