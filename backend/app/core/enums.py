from enum import Enum


class UserRole(str, Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    ADMIN = "ADMIN"


class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DocumentType(str, Enum):
    SELFIE = "selfie"
    CITIZENSHIP_FRONT = "citizenship_front"
    CITIZENSHIP_BACK = "citizenship_back"
    PAN_CARD = "pan_card"
    SELFIE_WITH_CITIZENSHIP = "selfie_with_citizenship"


class StudyLevel(str, Enum):
    CLASS_8 = "CLASS_8"
    CLASS_9 = "CLASS_9"
    CLASS_10 = "CLASS_10"
    CLASS_11 = "CLASS_11"
    CLASS_12 = "CLASS_12"
    DIPLOMA = "DIPLOMA"
    BACHELOR = "BACHELOR"
    MASTER = "MASTER"
    PHD = "PHD"


# ── Session lifecycle ────────────────────────────────────────────────────────

class BookingStatus(str, Enum):
    """A Booking is the contract (multiple sessions agreed upon)."""
    PENDING_PAYMENT = "PENDING_PAYMENT"   # awaiting escrow capture
    ACTIVE = "ACTIVE"                      # payment captured, sessions ongoing
    COMPLETED = "COMPLETED"                # all sessions done
    CANCELLED_BY_STUDENT = "CANCELLED_BY_STUDENT"
    CANCELLED_BY_TEACHER = "CANCELLED_BY_TEACHER"
    DISPUTED = "DISPUTED"


class SessionStatus(str, Enum):
    """Individual session within a booking."""
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW_STUDENT = "NO_SHOW_STUDENT"
    NO_SHOW_TEACHER = "NO_SHOW_TEACHER"


# ── Payments ─────────────────────────────────────────────────────────────────

class TransactionType(str, Enum):
    DEBIT = "DEBIT"    # money leaves a party
    CREDIT = "CREDIT"  # money arrives to a party


class TransactionReason(str, Enum):
    BOOKING_ESCROW = "BOOKING_ESCROW"        # student pays full booking upfront
    SESSION_RELEASE = "SESSION_RELEASE"      # released from escrow to platform after session
    REFUND_CANCELLED = "REFUND_CANCELLED"    # uncompleted sessions refunded to student
    WEEKLY_PAYOUT = "WEEKLY_PAYOUT"          # platform pays teacher
    PLATFORM_FEE = "PLATFORM_FEE"


class PayoutStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class EsewaCallbackStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    PENDING = "PENDING"


# ── Ratings ───────────────────────────────────────────────────────────────────

class RatingScore(int, Enum):
    ONE = 1
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5


# ── Reports / Moderation ─────────────────────────────────────────────────────

class ReportReason(str, Enum):
    INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT"
    HARASSMENT = "HARASSMENT"
    NO_SHOW = "NO_SHOW"
    FRAUD = "FRAUD"
    POOR_QUALITY = "POOR_QUALITY"
    OTHER = "OTHER"


class ReportStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class BanStatus(str, Enum):
    ACTIVE = "ACTIVE"
    LIFTED = "LIFTED"


# ── LiveKit / Room ────────────────────────────────────────────────────────────

class RoomStatus(str, Enum):
    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    ENDED = "ENDED"