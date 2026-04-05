from fastapi import FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from contextlib import asynccontextmanager
import socketio
from socketio import ASGIApp

from app.core.config import settings
from app.core.logging import configure_logging
from app.core.exception_handlers import register_exception_handlers
from app.db.session import sessionmanager
from app.api.v1.router import api_router
from app.utils.livekit import init_livekit, close_livekit, get_livekit_api
from app.middleware.cookie_to_header import CookieToHeaderMiddleware
from app.middleware.request_context import RequestContextMiddleware
from app.core.socketio import create_socketio_server, SocketIOManager
from app.api.v1.socketio_handlers import setup_socketio_handlers


async def _count_livekit_rooms() -> dict:
    """Count active LiveKit rooms using the LiveKit API client"""
    try:
        # Get the initialized LiveKit API client
        livekit_api = get_livekit_api()
        
        # Use room service to list rooms
        from livekit import api as livekit_api_module
        list_request = livekit_api_module.ListRoomsRequest()
        rooms_response = await livekit_api.room.list_rooms(list_request)
        
        return {
            "count": len(rooms_response.rooms),
            "rooms": [
                {
                    "name": room.name,
                    "participants": room.num_participants,
                    "max_participants": room.max_participants,
                }
                for room in rooms_response.rooms
            ]
        }
    except Exception as e:
        return {"error": f"Failed to fetch rooms: {str(e)}", "count": 0}


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    await sessionmanager.init()
    await init_livekit()
    yield
    await close_livekit()
    await sessionmanager.close()


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan,
    )

    # Register exception handlers (must be done before adding middleware)
    register_exception_handlers(app)

    # Add middleware in reverse order of execution (bottom to top)
    # Request context middleware first (innermost)
    app.add_middleware(RequestContextMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,
    )

    # Middleware to copy HttpOnly auth cookies into headers for existing
    # header-based auth logic.
    app.add_middleware(CookieToHeaderMiddleware)

    app.include_router(api_router, prefix=settings.API_V1_STR)
    
    # ── Debug route to count active LiveKit rooms ──
    @app.get("/debug/count-rooms")
    async def count_active_rooms():
        """
        Debug endpoint to check active LiveKit rooms.
        Returns count and details of all active rooms in LiveKit SFU.
        TODO: Remove this endpoint in production.
        """
        result = await _count_livekit_rooms()
        return result

    return app


# Create Socket.IO server
sio = create_socketio_server()
socketio_manager = SocketIOManager(sio)

# Setup Socket.IO event handlers
setup_socketio_handlers(sio, socketio_manager)

# Create FastAPI app
fastapi_app = create_application()

# Wrap with Socket.IO ASGI app
app = ASGIApp(sio, fastapi_app)






