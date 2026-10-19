import json
import uuid
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.llm import build_llm_provider

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


def sse(event: str, data: object) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    trace_id = str(uuid.uuid4())

    async def event_stream():
        try:
            provider = build_llm_provider()

            messages = [message.model_dump() for message in request.messages]

            async for chunk in provider.stream(messages):
                yield sse("token", chunk)

            yield sse("done", {"trace_id": trace_id})

        except (ConnectionError, TimeoutError, ValueError):
            yield sse(
                "error",
                {
                    "trace_id": trace_id,
                    "error": "stream_failed",
                },
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Trace-Id": trace_id,
        },
    )
