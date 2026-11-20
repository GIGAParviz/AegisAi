import logging
from contextlib import contextmanager
from contextvars import ContextVar
from functools import lru_cache
from typing import Any, Literal
from uuid import uuid4

from app.core.config import settings

logger = logging.getLogger(__name__)
_trace_id: ContextVar[str | None] = ContextVar("aegis_trace_id", default=None)


class NoopObservation:
    def update(self, **kwargs: Any) -> None:
        return None


class SafeObservation:
    def __init__(self, observation: Any) -> None:
        self._observation = observation

    def update(self, **kwargs: Any) -> None:
        try:
            self._observation.update(**kwargs)
        except Exception:
            logger.warning("Langfuse observation update failed", exc_info=True)


@lru_cache(maxsize=4)
def _create_client(public_key: str, secret_key: str, base_url: str) -> Any:
    from langfuse import Langfuse

    return Langfuse(
        public_key=public_key,
        secret_key=secret_key,
        base_url=base_url,
        tracing_enabled=True,
    )


def _get_client() -> Any | None:
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        return None
    return _create_client(
        settings.langfuse_public_key,
        settings.langfuse_secret_key,
        settings.langfuse_base_url,
    )


def get_trace_id() -> str | None:
    return _trace_id.get()


@contextmanager
def start_span(
    name: str,
    *,
    as_type: Literal[
        "span",
        "generation",
        "embedding",
        "agent",
        "tool",
        "chain",
        "retriever",
        "evaluator",
        "guardrail",
    ] = "span",
    input: Any | None = None,
    output: Any | None = None,
    metadata: dict[str, str] | None = None,
    model: str | None = None,
    model_parameters: dict[str, Any] | None = None,
):
    trace_id = _trace_id.get()
    token = None
    if trace_id is None:
        trace_id = uuid4().hex
        token = _trace_id.set(trace_id)

    try:
        try:
            client = _get_client()
        except Exception:
            logger.warning("Langfuse client initialization failed", exc_info=True)
            client = None

        if client is None:
            yield NoopObservation()
            return

        span_metadata = dict(metadata or {})
        span_metadata.setdefault("request_id", trace_id)
        observation_args: dict[str, Any] = {
            "name": name,
            "as_type": as_type,
            "metadata": span_metadata,
        }
        if input is not None:
            observation_args["input"] = input
        if output is not None:
            observation_args["output"] = output
        if model is not None:
            observation_args["model"] = model
        if model_parameters is not None:
            observation_args["model_parameters"] = model_parameters

        try:
            manager = client.start_as_current_observation(**observation_args)
            observation = manager.__enter__()
        except Exception:
            logger.warning("Langfuse span creation failed", exc_info=True)
            yield NoopObservation()
            return

        safe_observation = SafeObservation(observation)
        try:
            yield safe_observation
        except BaseException as exc:
            safe_observation.update(
                level="ERROR",
                status_message=type(exc).__name__,
            )
            try:
                manager.__exit__(type(exc), exc, exc.__traceback__)
            except Exception:
                logger.warning("Langfuse span close failed", exc_info=True)
            raise
        else:
            try:
                manager.__exit__(None, None, None)
            except Exception:
                logger.warning("Langfuse span close failed", exc_info=True)
    finally:
        if token is not None:
            _trace_id.reset(token)


@contextmanager
def start_trace(
    name: str = "http.request",
    *,
    trace_id: str | None = None,
    input: Any | None = None,
    metadata: dict[str, str] | None = None,
):
    request_id = trace_id or uuid4().hex
    token = _trace_id.set(request_id)
    trace_metadata = dict(metadata or {})
    trace_metadata["request_id"] = request_id
    try:
        with start_span(
            name,
            input=input,
            metadata=trace_metadata,
        ) as observation:
            yield observation
    finally:
        _trace_id.reset(token)


def shutdown_tracing() -> None:
    try:
        client = _get_client()
    except Exception:
        logger.warning("Langfuse client shutdown lookup failed", exc_info=True)
        return
    if client is None:
        return
    for method_name in ("flush", "shutdown"):
        method = getattr(client, method_name, None)
        if callable(method):
            try:
                method()
            except Exception:
                logger.warning("Langfuse %s failed", method_name, exc_info=True)
