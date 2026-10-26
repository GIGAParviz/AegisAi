from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import settings

T = TypeVar("T", bound=BaseModel)

Rule = Callable[[Any], tuple[bool, str]]

class VerificationError(Exception):
    def __init__(self, message: str, errors: list[str]) -> None:
        super().__init__(message)
        self.errors = errors

@dataclass(frozen=True)
class VerifyResult:
    is_valid: bool
    data: Any | None = None
    errors: list[str] = field(default_factory=list)


def verify(
    output: str | dict[str, Any] | BaseModel,
    schema: type[T] | None = None,
    rules: Sequence[Rule] | None = None,
) -> VerifyResult:
    errors: list[str] = []
    parsed_data: Any = output

    if isinstance(output, str):
        try:
            parsed_data = json.loads(output)
        except json.JSONDecodeError as exc:
            return VerifyResult(
                is_valid=False,
                errors=[f"Invalid JSON format: {exc}"],
            )

    if schema is not None:
        if isinstance(parsed_data, schema):
            validated_obj = parsed_data
        else:
            try:
                validated_obj = schema.model_validate(parsed_data)
                parsed_data = validated_obj
            except ValidationError as exc:
                for err in exc.errors():
                    field_name = ".".join(str(loc) for loc in err["loc"])
                    errors.append(f"Field '{field_name}': {err['msg']}")
                return VerifyResult(is_valid=False, errors=errors)

    for rule in rules or []:
        passed, error_msg = rule(parsed_data)
        if not passed:
            errors.append(error_msg)

    if errors:
        return VerifyResult(is_valid=False, errors=errors)

    return VerifyResult(is_valid=True, data=parsed_data)


def build_repair_prompt(
    errors: list[str],
    original_output: str,
    schema: type[BaseModel] | None = None,
) -> str:
    schema_hint = f"\nExpected schema: {schema.model_json_schema()}" if schema else ""
    errors_list = "\n".join(f"- {err}" for err in errors)

    return (
        "Your previous response had the following validation errors:\n"
        f"{errors_list}\n"
        f"{schema_hint}\n"
        "Please fix these errors and provide ONLY the corrected, valid JSON response."
    )


async def verify_and_repair(
    generate_fn: Callable[[str], Awaitable[str]],
    initial_prompt: str,
    schema: type[T] | None = None,
    rules: Sequence[Rule] | None = None,
    max_retries: int | None = None,
) -> T | dict[str, Any]:
    retries = max_retries if max_retries is not None else settings.verifier_max_retries
    current_prompt = initial_prompt
    last_errors: list[str] = []

    for attempt in range(retries + 1):
        raw_output = await generate_fn(current_prompt)
        result = verify(raw_output, schema=schema, rules=rules)

        if result.is_valid:
            return result.data

        last_errors = result.errors

        if attempt < retries:
            repair_instruction = build_repair_prompt(
                errors=result.errors,
                original_output=raw_output,
                schema=schema,
            )
            current_prompt = (
                f"{initial_prompt}\n\n[Correction Request (Attempt {attempt + 1})]:\n{repair_instruction}"
            )

    raise VerificationError(
        f"Verification failed after {retries + 1} attempts.",
        errors=last_errors,
    )
