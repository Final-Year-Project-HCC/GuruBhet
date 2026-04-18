"""Socket.IO middleware for secure JWT authentication from HttpOnly cookies."""
import logging
from typing import Optional
from uuid import UUID

from app.core.security import decode_token

logger = logging.getLogger(__name__)


def extract_token_from_cookies(handshake_headers: dict[str, str]) -> Optional[str]:
    """
    Extract JWT token from HttpOnly cookies in handshake headers.
    
    Socket.IO passes headers as a dict from environ. We look for the 'cookie' header
    and parse it to find the 'access_token' cookie.
    
    Args:
        handshake_headers: The headers dict from Socket.IO environ
        
    Returns:
        JWT token string if found, None otherwise
    """
    cookie_header = handshake_headers.get("cookie", "")
    
    if not cookie_header:
        logger.warning("No cookie header found in Socket.IO handshake")
        return None
    
    # Parse cookie header: "cookie1=value1; cookie2=value2; ..."
    cookies = {}
    for cookie_part in cookie_header.split(";"):
        if "=" in cookie_part:
            key, value = cookie_part.split("=", 1)
            cookies[key.strip()] = value.strip()
    
    token = cookies.get("access_token")
    
    if token:
        logger.debug("Successfully extracted access_token from cookies")
    else:
        logger.warning("access_token not found in cookies")
    
    return token


async def verify_jwt_from_handshake(token: str) -> Optional[UUID]:
    """
    Verify JWT token and extract user_id.
    
    Args:
        token: JWT token string
        
    Returns:
        User ID if valid, None otherwise
    """
    try:
        payload = decode_token(token)
        if payload and "sub" in payload:
            user_id = UUID(payload["sub"])
            logger.debug(f"JWT verified for user {user_id}")
            return user_id
    except ValueError as e:
        logger.warning(f"JWT verification failed: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during JWT verification: {e}", exc_info=True)
    
    return None


def create_socketio_auth_middleware(sio):
    """
    Create Socket.IO authentication middleware.
    
    This middleware intercepts every Socket.IO connection and verifies the JWT
    from HttpOnly cookies before allowing the connection to proceed.
    
    Args:
        sio: Socket.IO AsyncServer instance
        
    Returns:
        Middleware function
    """
    
    @sio.event
    async def connect(sid: str, environ):
        """
        Handle Socket.IO connection with JWT validation from HttpOnly cookies.
        
        Flow:
        1. Extract token from handshake headers (HttpOnly cookies)
        2. Verify JWT and extract user_id
        3. Store user_id in session
        4. Join user to private room
        5. Return True to allow connection
        
        Args:
            sid: Socket session ID
            environ: WSGI environ dict containing headers
            
        Returns:
            True if connection allowed, False otherwise
        """
        logger.info(f"Socket.IO connect: sid={sid}")
        
        try:
            # Extract headers from environ
            # Headers are stored as wsgi.http_headers or can be reconstructed
            headers = {}
            
            # Parse headers from environ
            if "asgi.scope" in environ:
                for k, v in environ["asgi.scope"].get("headers", []):
                    headers[k.decode("utf-8").lower()] = v.decode("utf-8")
            else:
                for key, value in environ.items():
                    if key.startswith("HTTP_"):
                        # Convert HTTP_COOKIE to cookie, HTTP_CONTENT_TYPE to content-type, etc.
                        header_name = key[5:].lower().replace("_", "-")
                        headers[header_name] = value
            
            # Extract token from cookies
            token = extract_token_from_cookies(headers)
            
            if not token:
                logger.warning(f"Connection {sid} rejected: no token in cookies")
                return False
            
            # Verify token and get user_id
            user_id = await verify_jwt_from_handshake(token)
            
            if not user_id:
                logger.warning(f"Connection {sid} rejected: invalid token")
                return False
            
            # Store user_id in session for later retrieval
            session = await sio.get_session(sid)
            session["user_id"] = str(user_id)
            await sio.set_session(sid, session)
            
            logger.info(f"Socket.IO auth successful: user_id={user_id}, sid={sid}")
            return True
        
        except Exception as e:
            logger.error(f"Socket.IO auth error: {e}", exc_info=True)
            return False
    
    return connect
