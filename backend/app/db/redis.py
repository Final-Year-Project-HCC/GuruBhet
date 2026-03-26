from typing import Any
import json

import redis.asyncio as aioredis
from app.core.config import settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            str(settings.REDIS_URL),
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    r = await get_redis()
    await r.set(key, json.dumps(value), ex=ttl)


async def cache_get(key: str) -> Any | None:
    r = await get_redis()
    raw = await r.get(key)
    return json.loads(raw) if raw else None


async def cache_delete(key: str) -> None:
    r = await get_redis()
    await r.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    r = await get_redis()
    keys = await r.keys(pattern)
    if keys:
        await r.delete(*keys)


async def blacklist_jti(jti: str, expires_at: int) -> None:
    """Mark a token jti as blacklisted in Redis until its expiry timestamp.

    Key format: bl_jti:{jti}
    """
    r = await get_redis()
    from datetime import datetime, timezone
    now_ts = int(datetime.now(tz=timezone.utc).timestamp())
    ttl = max(0, int(expires_at) - now_ts)
    if ttl <= 0:
        # already expired; no need to store
        return
    await r.set(f"bl_jti:{jti}", "1", ex=ttl)


async def is_jti_blacklisted(jti: str) -> bool:
    r = await get_redis()
    return await r.exists(f"bl_jti:{jti}") == 1