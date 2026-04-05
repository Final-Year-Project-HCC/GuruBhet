"""
Global exception handlers for the FastAPI application.

Centralizes error handling and response formatting for:
- Custom GuruBhet exceptions
- Pydantic validation errors
- Database constraint violations
- External service errors
- Unhandled exceptions (with safe error messages)

All handlers format responses consistently with standardized error schemas.
"""

from datetime import datetime
from typing import Union

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from pydantic import ValidationError

from app.core.exceptions import GuruBhetException
from app.schemas.error import ErrorResponse, ValidationErrorResponse


logger = structlog.get_logger(__name__)


def get_request_id(request: Request) -> Union[str, None]:
    """Extract request ID from request state or headers."""
    return getattr(request.state, "request_id", None) or request.headers.get("x-trace-id")


def get_request_path(request: Request) -> str:
    """Get request path."""
    return request.url.path


async def guru_bhet_exception_handler(
    request: Request,
    exc: GuruBhetException,
) -> JSONResponse:
    """
    Handle custom GuruBhet exceptions.
    
    Maps exception properties to standardized error response.
    Logs exception with full context for debugging.
    """
    request_id = get_request_id(request)
    
    # Build error response
    error_response = ErrorResponse(
        code=exc.error_code.value,
        message=exc.detail,
        timestamp=datetime.utcnow(),
        trace_id=request_id,
        context=exc.context,
        request_path=get_request_path(request),
        http_status=exc.status_code,
    )
    
    # Log with appropriate level based on status code
    log_level = "warning" if exc.status_code >= 400 and exc.status_code < 500 else "error"
    logger_method = getattr(logger, log_level)
    
    logger_method(
        "guruBhet_exception",
        error_code=exc.error_code.value,
        status_code=exc.status_code,
        context=exc.context,
        cause=str(exc.cause) if exc.cause else None,
        exc_info=exc.cause is not None,
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": error_response.model_dump(exclude_none=True)},
    )


async def validation_error_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    Handle Pydantic validation errors from request parsing.
    
    Formats validation errors with field-level details.
    Distinguishes between different error types (type, value, missing, etc.)
    """
    request_id = get_request_id(request)
    
    # Extract field-level errors
    field_errors = {}
    for error in exc.errors():
        field_path = ".".join(str(loc) for loc in error["loc"][1:])
        field_msg = error["msg"]
        
        if field_path not in field_errors:
            field_errors[field_path] = []
        field_errors[field_path].append(field_msg)
    
    # Build error response
    error_response = ValidationErrorResponse(
        code="VALIDATION_ERROR",
        message="Request validation failed",
        timestamp=datetime.utcnow(),
        trace_id=request_id,
        context={"fields": field_errors},
        http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
    )
    
    logger.warning(
        "validation_error",
        status_code=422,
        field_count=len(field_errors),
        fields=list(field_errors.keys()),
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": error_response.model_dump()},
    )


async def integrity_error_handler(
    request: Request,
    exc: IntegrityError,
) -> JSONResponse:
    """
    Handle SQLAlchemy integrity constraint violations.
    
    Detects common constraint types:
    - Unique constraint (duplicate key)
    - Foreign key constraint
    - Not null constraint
    
    Provides user-friendly error messages.
    """
    request_id = get_request_id(request)
    
    # Parse integrity error message for constraint type
    error_msg = str(exc.orig)
    is_unique_error = "unique" in error_msg.lower()
    is_fk_error = "foreign key" in error_msg.lower()
    is_not_null_error = "not null" in error_msg.lower()
    
    # Build appropriate error message and code
    if is_unique_error:
        error_code = "RESOURCE_ALREADY_EXISTS"
        message = "Resource with this unique field already exists"
        status_code = status.HTTP_409_CONFLICT
    elif is_fk_error:
        error_code = "RESOURCE_NOT_FOUND"
        message = "Referenced resource not found"
        status_code = status.HTTP_404_NOT_FOUND
    elif is_not_null_error:
        error_code = "VALIDATION_ERROR"
        message = "Required field is missing"
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    else:
        error_code = "DATABASE_ERROR"
        message = "Database constraint violation"
        status_code = status.HTTP_400_BAD_REQUEST
    
    error_response = ErrorResponse(
        code=error_code,
        message=message,
        timestamp=datetime.utcnow(),
        trace_id=request_id,
        request_path=get_request_path(request),
        http_status=status_code,
    )
    
    logger.warning(
        "integrity_error",
        status_code=status_code,
        error_type=type(exc).__name__,
        is_unique=is_unique_error,
        is_fk=is_fk_error,
        is_not_null=is_not_null_error,
    )
    
    return JSONResponse(
        status_code=status_code,
        content={"error": error_response.model_dump()},
    )


async def sqlalchemy_error_handler(
    request: Request,
    exc: SQLAlchemyError,
) -> JSONResponse:
    """
    Handle generic SQLAlchemy errors.
    
    Logs full error details for debugging without exposing
    database internals to client.
    """
    request_id = get_request_id(request)
    
    error_response = ErrorResponse(
        code="DATABASE_ERROR",
        message="Database operation failed",
        timestamp=datetime.utcnow(),
        trace_id=request_id,
        request_path=get_request_path(request),
        http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
    
    logger.error(
        "database_error",
        error_type=type(exc).__name__,
        details=str(exc),
        exc_info=True,
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": error_response.model_dump()},
    )


async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """
    Handle unhandled exceptions (catch-all).
    
    Logs full stack trace for debugging while returning
    safe error message to client (no internal details exposed).
    
    This handler should be registered last to catch all
    exceptions that weren't handled by specific handlers.
    """
    request_id = get_request_id(request)
    
    # Generate error code for tracking
    error_code = f"INTERNAL_ERROR_{id(exc) % 10000}"
    
    error_response = ErrorResponse(
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected error occurred. Please contact support.",
        timestamp=datetime.utcnow(),
        trace_id=request_id,
        request_path=get_request_path(request),
        http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        context={"error_code": error_code},
    )
    
    logger.error(
        "unhandled_exception",
        error_type=type(exc).__name__,
        message=str(exc),
        trace_id=request_id,
        exc_info=True,
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": error_response.model_dump()},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """
    Register all exception handlers with the FastAPI app.
    
    Must be called during app initialization (in main.py).
    
    Handlers are registered in order of specificity:
    1. Custom GuruBhet exceptions (most specific)
    2. Pydantic validation errors
    3. Database errors (IntegrityError, SQLAlchemyError)
    4. Generic exceptions (catch-all, least specific)
    
    Args:
        app: FastAPI application instance
    """
    
    # Register custom exception handlers
    app.add_exception_handler(
        GuruBhetException,
        guru_bhet_exception_handler,
    )
    
    # Register validation error handler
    app.add_exception_handler(
        RequestValidationError,
        validation_error_handler,
    )
    
    # Register database error handlers
    # IntegrityError must come before SQLAlchemyError (inheritance)
    app.add_exception_handler(
        IntegrityError,
        integrity_error_handler,
    )
    app.add_exception_handler(
        SQLAlchemyError,
        sqlalchemy_error_handler,
    )
    
    # Register catch-all handler for any remaining exceptions
    # This should be last as it's the least specific
    app.add_exception_handler(
        Exception,
        generic_exception_handler,
    )
    
    logger.info("exception_handlers_registered", count=5)
