import orjson
from typing import List
from fastapi import APIRouter, Query, Request, Depends, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, text, or_
from sqlalchemy.orm import joinedload
import redis.asyncio as aioredis

from app.core.dependencies import DbSession
from app.db.redis import get_redis
from app.models.subject import Subject
from app.schemas.subject import SubjectRead
from app.core.exceptions import RateLimitError

router = APIRouter()

async def update_cache(redis: aioredis.Redis, key: str, data: list):
    """Background task to update cache without blocking the response."""
    await redis.set(key, orjson.dumps(data), ex=3600)

@router.get("/suggest", response_model=List[SubjectRead])
async def suggest_subjects(
    request: Request,
    db: DbSession,
    background_tasks: BackgroundTasks,
    q: str = Query(..., min_length=1, description="Search for subject name"),
    redis: aioredis.Redis = Depends(get_redis),
):
    # 1. Validate query parameter
    query_str = q.strip()
    if not query_str:
        raise HTTPException(
            status_code=400, 
            detail="Query parameter 'q' is required and must be a non-empty string."
        )
    
    if len(query_str) < 3:
        return []

    # 2. Rate limiting (60 RPM per IP)
    ip = request.client.host if request and request.client else "unknown"
    rl_key = f"suggestion_rl:{ip}"
    window = 60
    max_requests = 60
    
    async with redis.pipeline(transaction=True) as pipe:
        # Increment and get TTL in one go
        res = await pipe.incr(rl_key).ttl(rl_key).execute()
        reqs, ttl = res[0], res[1]
        if reqs == 1:
            await redis.expire(rl_key, window)

    if reqs > max_requests:
        raise RateLimitError(
            detail="Too Many Requests",
            context={"retry_after": ttl if ttl > 0 else window}
        )

    # 3. Caching
    cache_key = f"suggestion_cache:{query_str.lower()}"
    cached = await redis.get(cache_key)
    if cached:
        # Validate and serialize with Pydantic to ensure camelCase keys
        cached_data = orjson.loads(cached)
        suggestions = [SubjectRead.model_validate(item) for item in cached_data]
        return suggestions

    # 4. Single-Query Similarity Search with Eager Loading
    # Using joinedload avoids the N+1 problem by fetching relations in the same query
    stmt = (
        select(Subject)
        .options(
            joinedload(Subject.study_level),
            joinedload(Subject.board),
            joinedload(Subject.faculty)
        )
        .where(
            Subject.is_active == True,
            or_(
                Subject.name.ilike(f"{query_str}%"),      # Prefix match
                Subject.name.ilike(f"% {query_str}%"),    # Word boundary match
                text("subjects.name % :val")              # Trigram similarity
            )
        )
        .order_by(text("similarity(subjects.name, :val) DESC"))
        .params(val=query_str)
        .limit(10)
    )

    result = await db.execute(stmt)
    subjects = result.scalars().all()

    suggestions = [
        SubjectRead(
            id=s.id,
            name=s.name,
            study_level_name=s.study_level.name if s.study_level else None,
            board_name=s.board.name if s.board else None,
            faculty_name=s.faculty.name if s.faculty else None,
            unit_type=s.faculty.unit_type if s.faculty else None,
            unit_value=s.unit_value,
        )
        for s in subjects
    ]

    # 5. Background Caching
    if suggestions:
        # model_dump() is used to prepare the list for orjson serialization
        data_to_cache = [s.model_dump(mode='json') for s in suggestions]
        background_tasks.add_task(update_cache, redis, cache_key, data_to_cache)

    return suggestions