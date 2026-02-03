from __future__ import annotations
import time
from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings

def _minute_bucket(ts: float) -> int:
    return int(ts // 60)

class RateLimitMiddleware:
    '''
    Simple fixed-window rate limiting backed by Redis.

    Keys:
      rl:{user_or_ip}:{route}:{minute_bucket}

    Limits:
      - GET */balance  -> RATE_LIMIT_PER_MIN_BALANCE
      - POST /transfers -> RATE_LIMIT_PER_MIN_TRANSFER
    '''
    def __init__(self, app, redis):
        self.app = app
        self.redis = redis

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        path = scope.get("path", "")
        method = scope.get("method", "GET").upper()

        if method == "GET" and path.endswith("/balance"):
            limit = settings.RATE_LIMIT_PER_MIN_BALANCE
            route_tag = "balance"
        elif method == "POST" and path == "/transfers":
            limit = settings.RATE_LIMIT_PER_MIN_TRANSFER
            route_tag = "transfer"
        else:
            await self.app(scope, receive, send)
            return

        auth = request.headers.get("authorization", "")
        user_or_ip = "anonymous"
        if auth.lower().startswith("bearer "):
            user_or_ip = auth[-24:]
        else:
            client = scope.get("client")
            user_or_ip = client[0] if client else "unknown"

        bucket = _minute_bucket(time.time())
        key = f"rl:{user_or_ip}:{route_tag}:{bucket}"

        count = await self.redis.incr(key)
        if count == 1:
            await self.redis.expire(key, 70)

        if count > limit:
            resp = JSONResponse(
                status_code=429,
                content={"detail": "Too Many Requests", "limit_per_min": limit, "route": route_tag},
            )
            await resp(scope, receive, send)
            return

        await self.app(scope, receive, send)
