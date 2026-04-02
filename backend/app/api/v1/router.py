from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    subjects,
    teachers,
    students,
    bookings,
    sessions,
    payments,
    ratings,
    moderation,
    admin,
    livekit,
    media,
    academic_domains,
)

api_router = APIRouter()

api_router.include_router(auth.router,             prefix="/auth",       tags=["Auth"])
api_router.include_router(users.router,            prefix="/users",      tags=["Users"])
api_router.include_router(students.router,         prefix="/students",   tags=["Students"])
api_router.include_router(subjects.router,         prefix="/subjects",   tags=["Subjects"])
api_router.include_router(teachers.router,         prefix="/teachers",   tags=["Teachers"])
api_router.include_router(bookings.router,         prefix="/bookings",   tags=["Bookings"])
api_router.include_router(sessions.router,         prefix="/sessions",   tags=["Sessions"])
api_router.include_router(payments.router,         prefix="/payments",   tags=["Payments"])
api_router.include_router(ratings.router,          prefix="/ratings",    tags=["Ratings"])
api_router.include_router(moderation.router,       prefix="/moderation", tags=["Moderation"])
api_router.include_router(admin.router,            prefix="/admin",      tags=["Admin"])
api_router.include_router(livekit.router,          prefix="/livekit",    tags=["LiveKit"])
api_router.include_router(media.router,            prefix="/media",      tags=["Media"])
api_router.include_router(academic_domains.router, prefix="/academic",   tags=["Academic"])