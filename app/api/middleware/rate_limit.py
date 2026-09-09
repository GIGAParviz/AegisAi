import asyncio
import math
import time
from collections.abc import Awaitable, Callable

from fastapi import Request, Response, status
from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        redis_client: Redis | None = None,
        limit: int = 60,
        window_seconds: int = 60,
    ):
        super().__init__(app)

        self.redis = redis_client
        self.limit = limit
        self.window_seconds = window_seconds

        self.memory_store: dict[str, tuple[int, float]] = {}
        self.memory_lock = asyncio.Lock()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        client_id = self._get_client_id(request)
        key = f"rate_limit:{client_id}"

        count, retry_after = await self._get_request_count(key)

        if count > self.limit:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded",
                },
                headers={
                    "Retry-After": str(retry_after),
                },
            )

        response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(
            max(self.limit - count, 0)
        )

        return response

    @staticmethod
    def _get_client_id(request: Request) -> str:
        if request.client is None:
            return "unknown"

        return request.client.host

    async def _get_request_count(
        self,
        key: str,
    ) -> tuple[int, int]:
        if self.redis is not None:
            try:
                return await self._redis_count(key)

            except RedisError:
                pass

        return await self._memory_count(key)

    async def _redis_count(
        self,
        key: str,
    ) -> tuple[int, int]:
        assert self.redis is not None

        count = await self.redis.incr(key)

        if count == 1:
            await self.redis.expire(
                key,
                self.window_seconds,
            )

        ttl = await self.redis.ttl(key)

        # Safety: اگر INCR انجام شد ولی EXPIRE به هر دلیلی ثبت نشد
        if ttl < 0:
            await self.redis.expire(
                key,
                self.window_seconds,
            )
            ttl = self.window_seconds

        return count, max(ttl, 1)

    async def _memory_count(
        self,
        key: str,
    ) -> tuple[int, int]:
        now = time.monotonic()

        async with self.memory_lock:
            count, reset_at = self.memory_store.get(
                key,
                (0, now + self.window_seconds),
            )

            if now >= reset_at:
                count = 0
                reset_at = now + self.window_seconds

            count += 1

            self.memory_store[key] = (
                count,
                reset_at,
            )

        retry_after = math.ceil(reset_at - now)

        return count, max(retry_after, 1)