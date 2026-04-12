
from fastapi import APIRouter, Query, Request, status
from sqlalchemy import select, text
import redis.asyncio as aioredis
from app.core.dependencies import DbSession
from app.db.redis import get_redis
from app.models.subject import Subject
from uuid import UUID
from fastapi.responses import JSONResponse

router = APIRouter()

@router.get("/suggest")
async def suggest_subjects(
    q: str = Query(..., min_length=1, description="Prefix search for subject name"),
    db: DbSession = None,
    redis: aioredis.Redis = Depends(get_redis),
    request: Request = None,
):
    # 1. Validate query length
    if len(q) < 3:
        return []

    # 2. Rate limiting (60 RPM per IP)
    ip = request.client.host if request and request.client else "unknown"
    rl_key = f"suggestion_rl:{ip}"
    window = 60
    max_requests = 60
    reqs = await redis.incr(rl_key)
    if reqs == 1:
        await redis.expire(rl_key, window)
    ttl = await redis.ttl(rl_key)
    if reqs > max_requests:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too Many Requests"},
            headers={"Retry-After": str(ttl if ttl > 0 else window)},
        )

    # 3. Caching
    cache_key = f"suggestion_cache:{q.lower()}"
    cached = await redis.get(cache_key)
    if cached:
        import json
        return JSONResponse(content=json.loads(cached))

    # 4. Optimized DB search (prefix match at any word boundary)
    # Pattern: match start of any word
    # Example: 'Bio' matches 'Biology', 'Molecular Biology'
    stmt = select(Subject.id, Subject.name).where(
        text("name ILIKE :pattern AND is_active = true")
    ).params(pattern=f"% {q}%").limit(10)
    # Also match at the start of the string
    stmt2 = select(Subject.id, Subject.name).where(
        Subject.name.ilike(f"{q}%"),
        Subject.is_active == True
    ).limit(10)

    result = await db.execute(stmt)
    matches = list(result.all())
    # Add matches from start of string if not already included
    result2 = await db.execute(stmt2)
    matches2 = list(result2.all())
    seen_ids = {m[0] for m in matches}
    for m in matches2:
        if m[0] not in seen_ids:
            matches.append(m)
            seen_ids.add(m[0])
    # Limit to 10
    matches = matches[:10]
    suggestions = [{"id": str(m[0]), "name": m[1]} for m in matches]

    # 5. Cache result for 60 minutes
    import json
    await redis.set(cache_key, json.dumps(suggestions), ex=60*60)

    return suggestions

