from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class CookieToHeaderMiddleware(BaseHTTPMiddleware):
    """If httponly cookies `access_token` or `refresh_token` are present,
    copy them into headers `x-access-token` and `x-refresh-token` so downstream
    auth dependency code that reads headers continues to work.

    This keeps cookies HttpOnly while allowing existing header-based logic to
    function.
    """

    async def dispatch(self, request: Request, call_next):
        access = request.cookies.get("access_token")
        refresh = request.cookies.get("refresh_token")
        if access and "x-access-token" not in request.headers:
            # Starlette's request.headers is immutable; set in scope for downstream
            request.scope.setdefault("headers", [])
            request.scope["headers"].append((b"x-access-token", access.encode()))
        if refresh and "x-refresh-token" not in request.headers:
            request.scope.setdefault("headers", [])
            request.scope["headers"].append((b"x-refresh-token", refresh.encode()))

        response = await call_next(request)
        return response
