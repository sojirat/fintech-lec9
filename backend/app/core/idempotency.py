from __future__ import annotations
import json
from fastapi import Request
from fastapi.responses import JSONResponse

IDEMPOTENCY_HEADER = "idempotency-key"

class IdempotencyMiddleware:
    '''
    Idempotency middleware for POST /transfers.

    - Client sends: Idempotency-Key: <uuid>
    - Server stores response JSON + status keyed by:
        idem:{auth_tail}:{path}:{key}
    - Replays return the same response without re-running business logic.
    '''
    def __init__(self, app, redis, ttl_seconds: int = 24 * 3600):
        self.app = app
        self.redis = redis
        self.ttl = ttl_seconds

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        path = scope.get("path", "")
        method = scope.get("method", "GET").upper()

        if not (method == "POST" and path == "/transfers"):
            await self.app(scope, receive, send)
            return

        key = request.headers.get(IDEMPOTENCY_HEADER)
        if not key:
            await self.app(scope, receive, send)
            return

        auth = request.headers.get("authorization", "anonymous")
        idem_key = f"idem:{auth[-24:]}:{path}:{key}"

        cached = await self.redis.get(idem_key)
        if cached:
            payload = json.loads(cached)
            resp = JSONResponse(status_code=payload["status_code"], content=payload["json"])
            await resp(scope, receive, send)
            return

        body_chunks = []
        status_code_holder = {"status": 200}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code_holder["status"] = message["status"]
            if message["type"] == "http.response.body":
                body_chunks.append(message.get("body", b""))
            await send(message)

        await self.app(scope, receive, send_wrapper)

        try:
            body = b"".join(body_chunks).decode("utf-8") if body_chunks else ""
            if body:
                data = json.loads(body)
                await self.redis.setex(
                    idem_key,
                    self.ttl,
                    json.dumps({"status_code": status_code_holder["status"], "json": data}),
                )
        except Exception:
            pass
