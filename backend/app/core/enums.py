from enum import Enum


class UserRole(str, Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    STAFF = "STAFF"


class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DocumentType(str, Enum):
    NID_FRONT = "NID_FRONT"
    NID_BACK = "NID_BACK"
    PAN_CARD = "PAN_CARD"
    SELFIE_WITH_NID = "SELFIE_WITH_NID"


class UnitType(str, Enum):
    """Unit type for Subject hierarchies (Board/Faculty level)."""
    GRADE = "GRADE"        # For school-level education (Grade 1-12)
    SEMESTER = "SEMESTER"  # For university programs (1-8 semesters)
    YEAR = "YEAR"          # For multi-year programs (Year 1-4)


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
    PENDING_APPROVAL = "PENDING_APPROVAL"  # awaiting teacher approval after student request
    PENDING_PAYMENT = "PENDING_PAYMENT"   # awaiting escrow capture
    ACTIVE = "ACTIVE"                      # payment captured, sessions ongoing
    COMPLETED = "COMPLETED"                # all sessions done
    CANCELLED_BY_STUDENT = "CANCELLED_BY_STUDENT"
    CANCELLED_BY_TEACHER = "CANCELLED_BY_TEACHER"


class SessionStatus(str, Enum):
    """Individual session within a booking."""
    READY = "READY"  # room created, waiting for webhook to transition to IN_PROGRESS
    IN_PROGRESS = "IN_PROGRESS"  # room started, webhook fired, actual_start_at set
    COMPLETED = "COMPLETED"
    CANCELLED_BY_STUDENT = "CANCELLED_BY_STUDENT"
    CANCELLED_BY_TEACHER = "CANCELLED_BY_TEACHER"


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
class AuditActionType(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    READ = "READ"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    VERIFY = "VERIFY"
    BAN = "BAN"
    OTHER = "OTHER"
