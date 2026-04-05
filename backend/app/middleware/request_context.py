"""
Request context middleware for request tracing and correlation logging.

Implements request ID generation and context propagation for:
- Distributed request tracing across services
- Correlation of logs for a single request
- Request/response timing
- User context in logs
"""

import uuid
import time
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add request context (trace ID, timing) to all requests.
    
    Features:
    - Generates unique request ID (X-Trace-ID, X-Request-ID)
    - Binds request context to structlog for correlation
    - Adds request timing information
    - Includes trace ID in response headers
    - Logs request start/completion with context
    """
    
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.logger = structlog.get_logger(__name__)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and add context.
        
        Args:
            request: Incoming HTTP request
            call_next: Next middleware/handler
            
        Returns:
            Response with trace ID header
        """
        # Generate or extract request ID
        request_id = request.headers.get(
            "x-trace-id", 
            request.headers.get("x-request-id", str(uuid.uuid4()))
        )
        
        # Extract user info if available (from request state set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        user_role = getattr(request.state, "user_role", None)
        
        # Clear previous context and set up new context for this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client=request.client.host if request.client else "unknown",
        )
        
        # Add user context if authenticated
        if user_id:
            structlog.contextvars.bind_contextvars(
                user_id=user_id,
                user_role=user_role,
            )
        
        # Store request ID in state for access in handlers
        request.state.request_id = request_id
        request.state.start_time = time.time()
        
        # Log request start
        self.logger.info(
            "request_start",
            query_params=dict(request.query_params),
        )
        
        response = None
        try:
            # Process request
            response = await call_next(request)
        except Exception as exc:
            # Calculate request duration for error logging
            duration_ms = (time.time() - request.state.start_time) * 1000
            
            # Log exception with full context
            self.logger.error(
                "request_failed",
                error_type=type(exc).__name__,
                error=str(exc),
                duration_ms=duration_ms,
                exc_info=True,
            )
            raise
        finally:
            # Log response completion only if response exists
            if response is not None:
                duration_ms = (time.time() - request.state.start_time) * 1000
                self.logger.info(
                    "request_complete",
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                )
        
        # Add trace ID to response headers
        response.headers["X-Trace-ID"] = request_id
        response.headers["X-Request-ID"] = request_id
        
        return response


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Alternative middleware for correlation ID handling.
    Simpler than RequestContextMiddleware - use if you only need IDs without logging context.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get or generate correlation ID
        correlation_id = request.headers.get(
            "x-correlation-id",
            str(uuid.uuid4())
        )
        
        # Store in request state
        request.state.correlation_id = correlation_id
        
        # Process request
        response = await call_next(request)
        
        # Add to response headers for upstream services
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Trace-ID"] = correlation_id
        
        return response
