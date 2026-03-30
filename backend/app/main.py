from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from contextlib import asynccontextmanager
import socketio
from socketio import ASGIApp

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import sessionmanager
from app.api.v1.router import api_router
from app.utils.livekit import init_livekit, close_livekit
from app.utils.s3 import s3_manager
from app.middleware.cookie_to_header import CookieToHeaderMiddleware
from app.core.socketio import create_socketio_server, SocketIOManager
from app.api.v1.socketio_handlers import setup_socketio_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    await sessionmanager.init()
    await init_livekit()
    s3_manager.create_buckets()  # Create S3 buckets if they don't exist
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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Middleware to copy HttpOnly auth cookies into headers for existing
    # header-based auth logic.
    app.add_middleware(CookieToHeaderMiddleware)

    app.include_router(api_router, prefix=settings.API_V1_STR)

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






