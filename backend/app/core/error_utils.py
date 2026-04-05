"""
Error handling utilities and helpers.

Common patterns and utilities for consistent error handling across endpoints.
Provides functions for common validation and error scenarios.
"""

from typing import Optional, TypeVar, Generic, Callable, Any
import structlog
from sqlalchemy.orm import Session

from app.core.exceptions import (
    ResourceNotFoundError,
    ValidationError,
    PermissionDeniedError,
    UserNotFoundError,
    TeacherNotFoundError,
    StudentNotFoundError,
    BookingNotFoundError,
    SessionNotFoundError,
    SubjectNotFoundError,
)

logger = structlog.get_logger(__name__)

T = TypeVar("T")


# Generic resource fetching helpers

async def get_or_404(
    db: Session,
    model: type[T],
    id_value: Any,
    id_field: str = "id",
    exception_class: type[ResourceNotFoundError] = ResourceNotFoundError,
    context: Optional[dict] = None,
) -> T:
    """
    Fetch a resource by ID or raise 404 ResourceNotFoundError.
    
    Args:
        db: Database session
        model: SQLAlchemy model class
        id_value: Value to search for
        id_field: Field name to search in (default: "id")
        exception_class: Exception class to raise on not found
        context: Additional context for error response
        
    Returns:
        Resource instance
        
    Raises:
        ResourceNotFoundError: If resource not found
        
    Example:
        user = await get_or_404(db, User, user_id)
        teacher = await get_or_404(
            db, Teacher, teacher_id, 
            exception_class=TeacherNotFoundError
        )
    """
    query = db.query(model).filter(getattr(model, id_field) == id_value)
    result = query.first()
    
    if not result:
        error_context = context or {id_field: id_value}
        raise exception_class(context=error_context)
    
    return result


def require_permission(
    condition: bool,
    detail: str = "Permission denied",
    context: Optional[dict] = None,
) -> None:
    """
    Check permission and raise 403 if denied.
    
    Args:
        condition: Boolean condition that must be True
        detail: Error message for user
        context: Additional context (required role, etc.)
        
    Raises:
        PermissionDeniedError: If condition is False
        
    Example:
        require_permission(
            user.role == "staff",
            detail="Staff privileges required",
            context={"required_role": "staff"}
        )
    """
    if not condition:
        raise PermissionDeniedError(detail=detail, context=context)


def validate_value(
    condition: bool,
    detail: str = "Validation failed",
    context: Optional[dict] = None,
) -> None:
    """
    Validate a value and raise 400 if validation fails.
    
    Args:
        condition: Boolean condition that must be True
        detail: Error message for user
        context: Additional context (field name, value, etc.)
        
    Raises:
        ValidationError: If condition is False
        
    Example:
        validate_value(
            price > 0,
            detail="Price must be greater than 0",
            context={"field": "price", "value": price}
        )
    """
    if not condition:
        raise ValidationError(detail=detail, context=context)


# Specialized getters for common resources

async def get_user_or_404(db: Session, user_id: str) -> Any:
    """Get user or raise 404."""
    from app.models.user import User
    return await get_or_404(
        db, User, user_id,
        exception_class=UserNotFoundError
    )


async def get_teacher_or_404(db: Session, teacher_id: str) -> Any:
    """Get teacher or raise 404."""
    from app.models.teacher import Teacher
    return await get_or_404(
        db, Teacher, teacher_id,
        exception_class=TeacherNotFoundError
    )


async def get_student_or_404(db: Session, student_id: str) -> Any:
    """Get student or raise 404."""
    from app.models.student import Student
    return await get_or_404(
        db, Student, student_id,
        exception_class=StudentNotFoundError
    )


async def get_booking_or_404(db: Session, booking_id: str) -> Any:
    """Get booking or raise 404."""
    from app.models.booking import Booking
    return await get_or_404(
        db, Booking, booking_id,
        exception_class=BookingNotFoundError
    )


async def get_session_or_404(db: Session, session_id: str) -> Any:
    """Get session or raise 404."""
    from app.models.booking import Session
    return await get_or_404(
        db, Session, session_id,
        exception_class=SessionNotFoundError
    )


async def get_subject_or_404(db: Session, subject_id: str) -> Any:
    """Get subject or raise 404."""
    from app.models.subject import Subject
    return await get_or_404(
        db, Subject, subject_id,
        exception_class=SubjectNotFoundError
    )


# Context managers for error handling

class ErrorContext:
    """
    Context manager for graceful error handling with logging.
    
    Usage:
        with ErrorContext(logger, "Operation name"):
            # risky operation
            result = do_something()
        # Error is logged automatically if exception occurs
    """
    
    def __init__(self, logger_instance, operation: str):
        self.logger = logger_instance
        self.operation = operation
    
    def __enter__(self):
        self.logger.info(f"{self.operation}_started")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.logger.error(
                f"{self.operation}_failed",
                error_type=exc_type.__name__,
                error=str(exc_val),
                exc_info=True,
            )
            # Re-raise the exception after logging
            return False
        self.logger.info(f"{self.operation}_completed")
        return True


# Batch operation error handling

def batch_operation_with_errors(
    items: list[Any],
    operation: Callable[[Any], Any],
    operation_name: str = "batch_operation",
):
    """
    Execute operation on multiple items, collecting errors.
    
    Args:
        items: List of items to process
        operation: Callable to execute for each item
        operation_name: Name for logging
        
    Returns:
        dict with succeeded, failed, errors lists
        
    Example:
        result = batch_operation_with_errors(
            user_ids,
            lambda uid: delete_user(uid),
            "user_deletion"
        )
        if result["failed"] > 0:
            raise Exception(f"Failed to delete {result['failed']} users")
    """
    succeeded = []
    failed = []
    errors = []
    
    for item in items:
        try:
            result = operation(item)
            succeeded.append(result)
        except Exception as exc:
            failed.append(item)
            errors.append({
                "item": item,
                "error": str(exc),
                "type": type(exc).__name__,
            })
            logger.warning(
                f"{operation_name}_item_failed",
                item=item,
                error=str(exc),
            )
    
    logger.info(
        f"{operation_name}_batch_complete",
        total=len(items),
        succeeded=len(succeeded),
        failed=len(failed),
    )
    
    return {
        "succeeded": succeeded,
        "failed": failed,
        "errors": errors,
        "total": len(items),
    }


# Request data validators

def validate_pagination(
    skip: int = 0,
    limit: int = 10,
    max_limit: int = 100,
) -> tuple[int, int]:
    """
    Validate and normalize pagination parameters.
    
    Args:
        skip: Number of items to skip
        limit: Number of items to return
        max_limit: Maximum allowed limit
        
    Returns:
        Validated (skip, limit) tuple
        
    Raises:
        ValidationError: If parameters are invalid
        
    Example:
        skip, limit = validate_pagination(skip, limit)
        results = db.query(User).offset(skip).limit(limit).all()
    """
    validate_value(
        skip >= 0,
        detail="skip must be non-negative",
        context={"skip": skip},
    )
    
    validate_value(
        limit > 0,
        detail="limit must be positive",
        context={"limit": limit},
    )
    
    validate_value(
        limit <= max_limit,
        detail=f"limit must not exceed {max_limit}",
        context={"limit": limit, "max": max_limit},
    )
    
    return skip, limit


def validate_price_range(
    price: float,
    min_price: float = 0,
    max_price: float = 10000000,
) -> None:
    """
    Validate price is within acceptable range.
    
    Args:
        price: Price to validate
        min_price: Minimum allowed price
        max_price: Maximum allowed price
        
    Raises:
        ValidationError: If price is invalid
    """
    validate_value(
        min_price <= price <= max_price,
        detail=f"Price must be between {min_price} and {max_price}",
        context={"price": price, "min": min_price, "max": max_price},
    )


def validate_session_count(
    count: int,
    min_count: int = 1,
    max_count: int = 100,
) -> None:
    """
    Validate number of sessions.
    
    Args:
        count: Number of sessions
        min_count: Minimum allowed sessions
        max_count: Maximum allowed sessions
        
    Raises:
        ValidationError: If count is invalid
    """
    validate_value(
        min_count <= count <= max_count,
        detail=f"Number of sessions must be between {min_count} and {max_count}",
        context={"count": count, "min": min_count, "max": max_count},
    )


def validate_session_duration(
    duration_minutes: int,
    min_minutes: int = 15,
    max_minutes: int = 180,
    multiple_of: int = 15,
) -> None:
    """
    Validate session duration.
    
    Args:
        duration_minutes: Session duration in minutes
        min_minutes: Minimum allowed duration
        max_minutes: Maximum allowed duration
        multiple_of: Duration must be multiple of this value
        
    Raises:
        ValidationError: If duration is invalid
    """
    validate_value(
        min_minutes <= duration_minutes <= max_minutes,
        detail=f"Duration must be between {min_minutes} and {max_minutes} minutes",
        context={"duration": duration_minutes, "min": min_minutes, "max": max_minutes},
    )
    
    validate_value(
        duration_minutes % multiple_of == 0,
        detail=f"Duration must be a multiple of {multiple_of} minutes",
        context={"duration": duration_minutes, "multiple_of": multiple_of},
    )
