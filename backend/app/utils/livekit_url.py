"""
LiveKit URL Resolution Helper

Handles dynamic LiveKit URL generation based on client origin.
This allows cross-device connections (MacBook, iPad, etc.) to
connect to a local LiveKit instance using the correct IP address.
"""

from fastapi import Request
from app.core.config import settings


def get_livekit_url_for_client(request: Request) -> str:
    """
    Get the LiveKit URL for the requesting client.
    
    Converts localhost URLs to the client's origin IP/hostname.
    This allows clients on different devices/networks to connect
    to the local LiveKit instance.
    
    Args:
        request: FastAPI Request object with client info
        
    Returns:
        WebSocket URL for LiveKit (ws:// or wss://)
        
    Example:
        # Backend has LIVEKIT_URL=ws://localhost:7880
        # iPad connects from 192.168.1.100
        # Returns: ws://192.168.1.68:7880 (backend's IP)
    """
    livekit_url = settings.LIVEKIT_URL
    
    # If LIVEKIT_URL doesn't use localhost, return as-is
    if "localhost" not in livekit_url and "127.0.0.1" not in livekit_url:
        return livekit_url
    
    # Get client's request origin
    # Priority: X-Forwarded-Host > host header > client IP
    origin_host = request.headers.get("x-forwarded-host")
    if not origin_host:
        origin_host = request.headers.get("host")
    if not origin_host:
        origin_host = request.client.host if request.client else "localhost"
    
    # For local network connections, try to use backend's IP
    # This is in livekit.yaml as node_ip
    backend_ip = "192.168.1.68"  # From livekit.yaml node_ip
    
    # Determine if we should use backend IP or origin
    client_ip = request.client.host if request.client else None
    
    # If client is on same network (192.168.1.x), use backend IP
    if client_ip and client_ip.startswith("192.168.1."):
        # Use backend's IP for local network clients
        return livekit_url.replace("localhost", backend_ip).replace("127.0.0.1", backend_ip)
    
    # For external/different network clients, use origin
    # Strip port from host header if present
    if origin_host and ":" in origin_host:
        origin_host = origin_host.split(":")[0]
    
    # Replace localhost with client's origin
    if origin_host:
        return livekit_url.replace("localhost", origin_host).replace("127.0.0.1", origin_host)
    
    return livekit_url


def get_livekit_url_for_sync(request: Request) -> str:
    """
    Get the LiveKit URL for sync endpoint (reconnection).
    Same logic as get_livekit_url_for_client.
    """
    return get_livekit_url_for_client(request)
