"""
Custom exception classes for GuruBhet application.
Provides domain-specific exceptions with proper error codes and HTTP status mapping.

Industry standard patterns:
- Structured error codes for client routing (e.g., AUTH_INVALID_TOKEN)
- HTTP status codes mapped to exception types
- Proper exception hierarchy for error handling
- Context preservation for debugging and logging
"""

from enum import Enum
from typing import Any, Dict, Optional


class ErrorCode(str, Enum):
    """Standard error codes for API responses."""
    
    # Authentication & Authorization (401, 403)
    AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    AUTH_MISSING_TOKEN = "AUTH_MISSING_TOKEN"
    AUTH_INSUFFICIENT_PERMISSIONS = "AUTH_INSUFFICIENT_PERMISSIONS"
    AUTH_USER_DISABLED = "AUTH_USER_DISABLED"
    AUTH_EMAIL_NOT_VERIFIED = "AUTH_EMAIL_NOT_VERIFIED"
    AUTH_PAYMENT_SETUP_PENDING = "AUTH_PAYMENT_SETUP_PENDING"
    
    # Resource Not Found (404)
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    TEACHER_NOT_FOUND = "TEACHER_NOT_FOUND"
    STUDENT_NOT_FOUND = "STUDENT_NOT_FOUND"
    BOOKING_NOT_FOUND = "BOOKING_NOT_FOUND"
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    SUBJECT_NOT_FOUND = "SUBJECT_NOT_FOUND"
    
    # Validation & Conflict (400, 409)
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS"
    EMAIL_ALREADY_REGISTERED = "EMAIL_ALREADY_REGISTERED"
    PHONE_ALREADY_REGISTERED = "PHONE_ALREADY_REGISTERED"
    INVALID_REQUEST_DATA = "INVALID_REQUEST_DATA"
    DUPLICATE_BOOKING = "DUPLICATE_BOOKING"
    INVALID_DOCUMENT = "INVALID_DOCUMENT"
    
    # Business Logic Errors (400, 422)
    BOOKING_CONFLICT = "BOOKING_CONFLICT"
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE"
    INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION"
    INVALID_PRICE_RANGE = "INVALID_PRICE_RANGE"
    SESSION_NOT_AVAILABLE = "SESSION_NOT_AVAILABLE"
    CANNOT_MODIFY_COMPLETED_BOOKING = "CANNOT_MODIFY_COMPLETED_BOOKING"
    TEACHER_NOT_VERIFIED = "TEACHER_NOT_VERIFIED"
    
    # External Service Errors (503, 502)
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    LIVEKIT_SERVICE_UNAVAILABLE = "LIVEKIT_SERVICE_UNAVAILABLE"
    PAYMENT_GATEWAY_ERROR = "PAYMENT_GATEWAY_ERROR"
    REAL_TIME_SERVICE_ERROR = "REAL_TIME_SERVICE_ERROR"
    
    # Rate Limiting & Quota (429)
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    
    # Server Errors (500)
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    OPERATION_FAILED = "OPERATION_FAILED"
    UPLOAD_FAILED = "UPLOAD_FAILED"


class GuruBhetException(Exception):
    """
    Base exception class for all GuruBhet application errors.
    
    Provides structured error information including:
    - HTTP status code
    - Error code for client routing
    - Human-readable detail message
    - Additional context for logging and debugging
    """
    
    def __init__(
        self,
        error_code: ErrorCode,
        detail: str,
        status_code: int = 500,
        context: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None,
    ) -> None:
        """
        Initialize GuruBhet exception.
        
        Args:
            error_code: Machine-readable error code
            detail: Human-readable error message
            status_code: HTTP status code for this error
            context: Additional context data (user_id, resource_id, etc.)
            cause: Original exception that caused this error
        """
        self.error_code = error_code
        self.detail = detail
        self.status_code = status_code
        self.context = context or {}
        self.cause = cause
        
        super().__init__(detail)


# Authentication & Authorization Errors (401, 403)

class AuthenticationError(GuruBhetException):
    """Raised when authentication fails."""
    
    def __init__(
        self,
        detail: str = "Authentication failed",
        error_code: ErrorCode = ErrorCode.AUTH_INVALID_TOKEN,
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            error_code=error_code,
            detail=detail,
            status_code=401,
            cause=cause,
        )


class InvalidTokenError(AuthenticationError):
    """Raised when JWT token is invalid or malformed."""
    
    def __init__(self, detail: str = "Invalid token") -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.AUTH_INVALID_TOKEN,
        )


class TokenExpiredError(AuthenticationError):
    """Raised when JWT token has expired."""
    
    def __init__(self, detail: str = "Token has expired") -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.AUTH_TOKEN_EXPIRED,
        )


class InvalidCredentialsError(AuthenticationError):
    """Raised when username/password is incorrect."""
    
    def __init__(self, detail: str = "Invalid credentials") -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.AUTH_INVALID_CREDENTIALS,
        )


class MissingTokenError(AuthenticationError):
    """Raised when authentication token is missing."""
    
    def __init__(self, detail: str = "Missing authentication token") -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.AUTH_MISSING_TOKEN,
        )


class PermissionDeniedError(GuruBhetException):
    """Raised when user lacks required permissions."""
    
    def __init__(
        self,
        detail: str = "Insufficient permissions",
        error_code: ErrorCode = ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=error_code,
            detail=detail,
            status_code=403,
            context=context,
        )


class UserDisabledError(AuthenticationError):
    """Raised when user account is disabled or not found."""
    
    def __init__(self, detail: str = "User account is disabled or not found") -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.AUTH_USER_DISABLED,
        )


class EmailNotVerifiedError(PermissionDeniedError):
    """Raised when user email is not verified."""
    
    def __init__(
        self,
        detail: str = "Email not verified",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
            context=context,
        )


class InvalidDocumentError(GuruBhetException):
    """Raised when an uploaded document is invalid."""
    
    def __init__(
        self,
        detail: str = "Invalid document. Please check the file format and size.",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.INVALID_DOCUMENT,
            detail=detail,
            status_code=400,
            context=context,
        )


class UploadFailedError(GuruBhetException):
    """Raised when a file upload fails."""
    
    def __init__(
        self,
        detail: str = "File upload failed. Please try again later.",
        context: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.UPLOAD_FAILED,
            detail=detail,
            status_code=500,
            context=context,
            cause=cause,
        )


class PaymentSetupPendingError(PermissionDeniedError):
    """Raised when teacher payment setup is pending."""
    
    def __init__(
        self,
        detail: str = "Payment setup pending",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.AUTH_PAYMENT_SETUP_PENDING,
            context=context,
        )


# Resource Not Found Errors (404)

class ResourceNotFoundError(GuruBhetException):
    """Raised when a requested resource is not found."""
    
    def __init__(
        self,
        detail: str = "Resource not found",
        error_code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=error_code,
            detail=detail,
            status_code=404,
            context=context,
        )


class UserNotFoundError(ResourceNotFoundError):
    """Raised when user is not found."""
    
    def __init__(
        self,
        user_id: Optional[str] = None,
        detail: str = "User not found",
    ) -> None:
        context = {"user_id": user_id} if user_id else {}
        super().__init__(
            detail=detail,
            error_code=ErrorCode.USER_NOT_FOUND,
            context=context,
        )


class TeacherNotFoundError(ResourceNotFoundError):
    """Raised when teacher is not found."""
    
    def __init__(
        self,
        teacher_id: Optional[str] = None,
        detail: str = "Teacher not found",
    ) -> None:
        context = {"teacher_id": teacher_id} if teacher_id else {}
        super().__init__(
            detail=detail,
            error_code=ErrorCode.TEACHER_NOT_FOUND,
            context=context,
        )


class StudentNotFoundError(ResourceNotFoundError):
    """Raised when student is not found."""
    
    def __init__(
        self,
        student_id: Optional[str] = None,
        detail: str = "Student not found",
    ) -> None:
        context = {"student_id": student_id} if student_id else {}
        super().__init__(
            detail=detail,
            error_code=ErrorCode.STUDENT_NOT_FOUND,
            context=context,
        )


class BookingNotFoundError(ResourceNotFoundError):
    """Raised when booking is not found."""
    
    def __init__(
        self,
        booking_id: Optional[str] = None,
        detail: str = "Booking not found",
    ) -> None:
        context = {"booking_id": booking_id} if booking_id else {}
        super().__init__(
            detail=detail,
            error_code=ErrorCode.BOOKING_NOT_FOUND,
            context=context,
        )


class SessionNotFoundError(ResourceNotFoundError):
    """Raised when session is not found."""
    
    def __init__(
        self,
        session_id: Optional[str] = None,
        detail: str = "Session not found",
    ) -> None:
        context = {"session_id": session_id} if session_id else {}
        super().__init__(
            detail=detail,
            error_code=ErrorCode.SESSION_NOT_FOUND,
            context=context,
        )


class SubjectNotFoundError(ResourceNotFoundError):
    """Raised when subject is not found."""
    
    def __init__(
        self,
        subject_id: Optional[str] = None,
        detail: str = "Subject not found",
    ) -> None:
        context = {"subject_id": subject_id} if subject_id else {}
        super().__init__(
            detail=detail,
            error_code=ErrorCode.SUBJECT_NOT_FOUND,
            context=context,
        )


# Validation & Conflict Errors (400, 409)

class ValidationError(GuruBhetException):
    """Raised when request validation fails."""
    
    def __init__(
        self,
        detail: str = "Validation failed",
        error_code: ErrorCode = ErrorCode.VALIDATION_ERROR,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=error_code,
            detail=detail,
            status_code=400,
            context=context,
        )


class InvalidRequestError(ValidationError):
    """Raised when request data is invalid."""
    
    def __init__(
        self,
        detail: str = "Invalid request data",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.INVALID_REQUEST_DATA,
            context=context or {},
        )


class ConflictError(GuruBhetException):
    """Raised when resource already exists (conflict)."""
    
    def __init__(
        self,
        detail: str = "Resource already exists",
        error_code: ErrorCode = ErrorCode.RESOURCE_ALREADY_EXISTS,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=error_code,
            detail=detail,
            status_code=409,
            context=context,
        )


class DuplicateResourceError(ConflictError):
    """Raised when attempting to create duplicate resource."""
    
    def __init__(
        self,
        detail: str = "Resource already exists",
        error_code: ErrorCode = ErrorCode.RESOURCE_ALREADY_EXISTS,
    ) -> None:
        super().__init__(detail=detail, error_code=error_code)


class EmailAlreadyRegisteredError(ConflictError):
    """Raised when email is already registered."""
    
    def __init__(self, email: Optional[str] = None) -> None:
        context = {"email": email} if email else {}
        super().__init__(
            detail="Email is already registered",
            error_code=ErrorCode.EMAIL_ALREADY_REGISTERED,
            context=context,
        )


class PhoneAlreadyRegisteredError(ConflictError):
    """Raised when phone is already registered."""
    
    def __init__(self, phone: Optional[str] = None) -> None:
        context = {"phone": phone} if phone else {}
        super().__init__(
            detail="Phone is already registered",
            error_code=ErrorCode.PHONE_ALREADY_REGISTERED,
            context=context,
        )


# Business Logic Errors

class BookingConflictError(GuruBhetException):
    """Raised when booking time slot has conflicts."""
    
    def __init__(
        self,
        detail: str = "Time slot is not available",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.BOOKING_CONFLICT,
            detail=detail,
            status_code=400,
            context=context,
        )


class InsufficientBalanceError(GuruBhetException):
    """Raised when user has insufficient balance for operation."""
    
    def __init__(
        self,
        detail: str = "Insufficient balance",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.INSUFFICIENT_BALANCE,
            detail=detail,
            status_code=400,
            context=context,
        )


class InvalidStatusTransitionError(GuruBhetException):
    """Raised when attempting invalid status transition."""
    
    def __init__(
        self,
        detail: str = "Invalid status transition",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.INVALID_STATUS_TRANSITION,
            detail=detail,
            status_code=400,
            context=context,
        )


class TeacherNotVerifiedError(GuruBhetException):
    """Raised when teacher is not verified for operation."""
    
    def __init__(
        self,
        detail: str = "Teacher account is not verified",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.TEACHER_NOT_VERIFIED,
            detail=detail,
            status_code=400,
            context=context,
        )


# External Service Errors (503, 502)

class ExternalServiceError(GuruBhetException):
    """Raised when external service fails."""
    
    def __init__(
        self,
        detail: str = "External service unavailable",
        error_code: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR,
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            error_code=error_code,
            detail=detail,
            status_code=503,
            cause=cause,
        )


class LiveKitError(ExternalServiceError):
    """Raised when LiveKit service fails."""
    
    def __init__(
        self,
        detail: str = "Video service unavailable",
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.LIVEKIT_SERVICE_UNAVAILABLE,
            cause=cause,
        )


class PaymentGatewayError(ExternalServiceError):
    """Raised when payment gateway fails."""
    
    def __init__(
        self,
        detail: str = "Payment service unavailable",
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.PAYMENT_GATEWAY_ERROR,
            cause=cause,
        )


class RealTimeServiceError(ExternalServiceError):
    """Raised when real-time service (Socket.IO) fails."""
    
    def __init__(
        self,
        detail: str = "Real-time service unavailable",
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            detail=detail,
            error_code=ErrorCode.REAL_TIME_SERVICE_ERROR,
            cause=cause,
        )


# Rate Limiting Errors (429)

class RateLimitError(GuruBhetException):
    """Raised when rate limit is exceeded."""
    
    def __init__(
        self,
        detail: str = "Rate limit exceeded",
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.RATE_LIMIT_EXCEEDED,
            detail=detail,
            status_code=429,
            context=context,
        )


# Server/Database Errors (500)

class DatabaseError(GuruBhetException):
    """Raised when database operation fails."""
    
    def __init__(
        self,
        detail: str = "Database operation failed",
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.DATABASE_ERROR,
            detail=detail,
            status_code=500,
            cause=cause,
        )


class OperationFailedError(GuruBhetException):
    """Raised when operation fails for unknown reasons."""
    
    def __init__(
        self,
        detail: str = "Operation failed",
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(
            error_code=ErrorCode.OPERATION_FAILED,
            detail=detail,
            status_code=500,
            cause=cause,
        )
