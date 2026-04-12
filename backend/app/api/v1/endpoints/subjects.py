import orjson
from fastapi import APIRouter, Query, Request, status, Depends, BackgroundTasks
from sqlalchemy import select, text, or_
import redis.asyncio as aioredis
from app.core.dependencies import DbSession
from app.db.redis import get_redis
from app.models.subject import Subject
from fastapi.responses import JSONResponse
from app.core.exceptions import RateLimitError

router = APIRouter()

async def update_cache(redis: aioredis.Redis, key: str, data: list):
    """Background task to update cache without blocking the response."""
    await redis.set(key, orjson.dumps(data), ex=3600)

@router.get("/suggest")
async def suggest_subjects(
    request: Request,
    db: DbSession,
    background_tasks: BackgroundTasks,
    q: str = Query(..., min_length=1, description="Search for subject name"),
    redis: aioredis.Redis = Depends(get_redis),
):
    # 1. Validate query length
    if len(q) < 3:
        return []

    # 2. Rate limiting (60 RPM per IP)
    ip = request.client.host if request and request.client else "unknown"
    rl_key = f"suggestion_rl:{ip}"
    window = 60
    max_requests = 60
    
    # Use a pipeline for slightly better atomic behavior in Redis
    async with redis.pipeline(transaction=True) as pipe:
        res = await pipe.incr(rl_key).ttl(rl_key).execute()
        reqs, ttl = res[0], res[1]
        if reqs == 1:
            await redis.expire(rl_key, window)

    if reqs > max_requests:
        raise RateLimitError(
            detail="Too Many Requests",
            context={"retry_after": ttl if ttl > 0 else window}
        )

    # 3. Caching (Using orjson for faster parsing)
    cache_key = f"suggestion_cache:{q.lower().strip()}"
    cached = await redis.get(cache_key)
    if cached:
        return JSONResponse(content=orjson.loads(cached))

    # 4. Single-Query Similarity Search
    # This combines your prefix match and word-boundary match into one indexed operation.
    # It ranks results based on how closely they match 'q'.
    stmt = (
        select(Subject.id, Subject.name)
        .where(
            Subject.is_active == True,
            or_(
                Subject.name.ilike(f"{q}%"),         # Start of string (Fastest)
                Subject.name.ilike(f"% {q}%"),       # Start of any word
                text("name % :val")                  # Trigram similarity (Fuzzy)
            )
        )
        .params(val=q)
        .order_by(text(f"similarity(name, :val) DESC"))
        .limit(10)
    )

    result = await db.execute(stmt)
    rows = result.all()
    
    suggestions = [{"id": str(row.id), "name": row.name} for row in rows]

    # 5. Background Caching
    # We return the response immediately; the cache update happens after the send.
    if suggestions:
        background_tasks.add_task(update_cache, redis, cache_key, suggestions)

    return suggestions