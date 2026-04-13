import orjson
from typing import List
from fastapi import APIRouter, Query, Request, Depends, BackgroundTasks, HTTPException
from sqlalchemy import select, text, or_
from sqlalchemy.orm import joinedload
import redis.asyncio as aioredis

from app.core.dependencies import DbSession
from app.db.redis import get_redis
from app.models.subject import Subject
from app.schemas.subject import SubjectRead  # Ensure this matches the nested structure
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
    # 1. Validation
    query_str = q.strip()
    if not query_str:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required.")
    
    if len(query_str) < 3:
        return []

    # 2. Rate limiting
    ip = request.client.host if request and request.client else "unknown"
    rl_key = f"suggestion_rl:{ip}"
    
    async with redis.pipeline(transaction=True) as pipe:
        res = await pipe.incr(rl_key).ttl(rl_key).execute()
        reqs, ttl = res[0], res[1]
        if reqs == 1:
            await redis.expire(rl_key, 60)

    if reqs > 60:
        raise RateLimitError(detail="Too Many Requests", context={"retry_after": ttl})

    # 3. Cache Check
    cache_key = f"suggestion_cache:{query_str.lower()}"
    cached = await redis.get(cache_key)
    if cached:
        # Directly return the list; FastAPI will handle the response_model serialization
        return orjson.loads(cached)

    # 4. Deep Eager Loading (Solves N+1 for nested structure)
    # We use joinedload for faculty, and then sub-join board and study_level 
    # that belong to that faculty to match your requested structure.
    from app.models.subject import Faculty
    stmt = (
        select(Subject)
        .options(
            joinedload(Subject.faculty).joinedload(Faculty.board),
            joinedload(Subject.faculty).joinedload(Faculty.study_level)
        )
        .where(
            Subject.is_active == True,
            or_(
                Subject.name.ilike(f"{query_str}%"),
                Subject.name.ilike(f"% {query_str}%"),
                text("subjects.name % :val")
            )
        )
        .order_by(text("similarity(subjects.name, :val) DESC"))
        .params(val=query_str)
        .limit(10)
    )

    result = await db.execute(stmt)
    subjects = result.scalars().all()

    # 5. Efficient Mapping
    # Since from_attributes=True is set, we can use model_validate(s)
    suggestions = [SubjectRead.model_validate(s) for s in subjects]

    # 6. Background Caching
    if suggestions:
        # mode='json' ensures UUIDs and nested objects are serialized correctly
        data_to_cache = [s.model_dump(mode='json') for s in suggestions]
        background_tasks.add_task(update_cache, redis, cache_key, data_to_cache)

    return suggestions