"""
Standard error response schemas.

Provides consistent error response formats across all API endpoints,
following REST/JSON:API best practices with:
- Structured error codes for client routing
- Request trace IDs for debugging
- Timestamps for audit trails
- Additional context for development
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Individual error detail with code, message, and context."""
    
    code: str = Field(
        ...,
        description="Machine-readable error code (e.g., USER_NOT_FOUND)",
    )
    message: str = Field(
        ...,
        description="Human-readable error message",
    )
    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional context data (resource_id, field_name, etc.)",
    )


class ErrorResponse(BaseModel):
    """
    Standard error response format.
    
    Compatible with:
    - RFC 7807 (Problem Details for HTTP APIs)
    - JSON:API error format (partial)
    - FastAPI validation error style (enhanced)
    
    Example response (404):
    {
        "error": {
            "code": "USER_NOT_FOUND",
            "message": "User with ID 123 not found",
            "timestamp": "2024-01-15T10:30:45.123456Z",
            "trace_id": "550e8400-e29b-41d4-a716-446655440000",
            "context": {"user_id": "123"},
            "request_path": "/api/v1/users/123",
            "http_status": 404
        }
    }
    
    Example response (validation error - 400):
    {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "timestamp": "2024-01-15T10:30:45.123456Z",
            "trace_id": "550e8400-e29b-41d4-a716-446655440000",
            "context": {
                "fields": {
                    "email": ["Invalid email format"],
                    "phone": ["Phone must be 10 digits"]
                }
            },
            "http_status": 400
        }
    }
    """
    
    code: str = Field(
        ...,
        description="Machine-readable error code",
        example="USER_NOT_FOUND",
    )
    message: str = Field(
        ...,
        description="Human-readable error message",
        example="User with ID 123 not found",
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="ISO 8601 timestamp when error occurred",
    )
    trace_id: Optional[str] = Field(
        default=None,
        description="Request trace ID for debugging and log correlation",
        example="550e8400-e29b-41d4-a716-446655440000",
    )
    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional context (resource IDs, validation details, etc.)",
    )
    request_path: Optional[str] = Field(
        default=None,
        description="Request path that caused the error",
        example="/api/v1/users/123",
    )
    http_status: Optional[int] = Field(
        default=None,
        description="HTTP status code",
        example=404,
    )
    
    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "code": "AUTH_INVALID_TOKEN",
                    "message": "Token is invalid or expired",
                    "timestamp": "2024-01-15T10:30:45.123456Z",
                    "trace_id": "550e8400-e29b-41d4-a716-446655440000",
                    "http_status": 401,
                },
                {
                    "code": "BOOKING_CONFLICT",
                    "message": "Time slot is already booked",
                    "timestamp": "2024-01-15T10:30:45.123456Z",
                    "trace_id": "550e8400-e29b-41d4-a716-446655440000",
                    "context": {"start_time": "2024-01-15T14:00:00Z"},
                    "http_status": 400,
                },
            ]
        }


class ValidationErrorResponse(BaseModel):
    """
    Validation error response with field-level details.
    
    Example:
    {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "timestamp": "2024-01-15T10:30:45.123456Z",
            "trace_id": "550e8400-e29b-41d4-a716-446655440000",
            "context": {
                "fields": {
                    "email": ["Invalid email format"],
                    "rate_per_session": ["Must be greater than 0"],
                    "total_sessions": ["Must be between 1 and 100"]
                }
            },
            "http_status": 422
        }
    }
    """
    
    code: str = Field(
        default="VALIDATION_ERROR",
        description="Error code for validation errors",
    )
    message: str = Field(
        default="Request validation failed",
        description="Human-readable error message",
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="ISO 8601 timestamp",
    )
    trace_id: Optional[str] = Field(
        default=None,
        description="Request trace ID",
    )
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Field validation errors",
    )
    http_status: int = Field(
        default=422,
        description="HTTP status code",
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "timestamp": "2024-01-15T10:30:45.123456Z",
                "trace_id": "550e8400-e29b-41d4-a716-446655440000",
                "context": {
                    "fields": {
                        "email": ["Invalid email format"],
                        "rate_per_session": ["Must be greater than 0"],
                    }
                },
                "http_status": 422,
            }
        }


class MultiErrorResponse(BaseModel):
    """
    Response for multiple errors (used in batch operations or migrations).
    
    Example:
    {
        "message": "Operation completed with errors",
        "timestamp": "2024-01-15T10:30:45.123456Z",
        "trace_id": "550e8400-e29b-41d4-a716-446655440000",
        "total": 3,
        "succeeded": 1,
        "failed": 2,
        "errors": [
            {
                "code": "USER_NOT_FOUND",
                "message": "User 123 not found",
                "context": {"user_id": "123"}
            },
            {
                "code": "PERMISSION_DENIED",
                "message": "User 456 lacks permission",
                "context": {"user_id": "456"}
            }
        ]
    }
    """
    
    message: str = Field(
        ...,
        description="Summary message",
        example="Operation completed with errors",
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="ISO 8601 timestamp",
    )
    trace_id: Optional[str] = Field(
        default=None,
        description="Request trace ID",
    )
    total: int = Field(..., description="Total items processed")
    succeeded: int = Field(..., description="Number of successes")
    failed: int = Field(..., description="Number of failures")
    errors: List[ErrorDetail] = Field(
        default_factory=list,
        description="List of individual errors",
    )


# Response wrapper for successful responses with standard format

class DataResponse(BaseModel):
    """Standard response wrapper for successful API calls."""
    
    data: Any = Field(..., description="Response data")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="ISO 8601 timestamp",
    )
    trace_id: Optional[str] = Field(
        default=None,
        description="Request trace ID",
    )
