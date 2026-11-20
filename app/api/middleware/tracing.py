import logging
from time import perf_counter
from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.observability.tracing import start_trace

logger = logging.getLogger(__name__)


class RequestTracingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid4().hex
        started_at = perf_counter()
        method = str(scope.get("method", ""))
        status_code = 500

        async def send_with_trace_headers(message: Message) -> None:
            nonlocal status_code
            outgoing = message
            if message["type"] == "http.response.start":
                status_code = int(message.get("status", 500))
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() not in {b"x-request-id", b"x-trace-id"}
                ]
                request_id_bytes = request_id.encode("ascii")
                headers.extend(
                    [
                        (b"x-request-id", request_id_bytes),
                        (b"x-trace-id", request_id_bytes),
                    ]
                )
                outgoing = {**message, "headers": headers}
            await send(outgoing)

        with start_trace(
            "http.request",
            trace_id=request_id,
            input={"method": method},
            metadata={"http_method": method},
        ) as observation:
            try:
                await self.app(scope, receive, send_with_trace_headers)
            except Exception as exc:
                duration_ms = round((perf_counter() - started_at) * 1000, 2)
                observation.update(
                    output={"status_code": 500, "duration_ms": duration_ms},
                    level="ERROR",
                    status_message=type(exc).__name__,
                )
                logger.exception(
                    "request failed trace_id=%s",
                    request_id,
                    extra={"trace_id": request_id, "http_status_code": 500},
                )
                raise
            else:
                duration_ms = round((perf_counter() - started_at) * 1000, 2)
                observation.update(
                    output={
                        "status_code": status_code,
                        "duration_ms": duration_ms,
                    }
                )
                logger.info(
                    "request completed trace_id=%s status=%s",
                    request_id,
                    status_code,
                    extra={"trace_id": request_id, "http_status_code": status_code},
                )
