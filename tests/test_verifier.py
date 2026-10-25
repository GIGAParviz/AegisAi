import json

import pytest
from pydantic import BaseModel, Field

from app.services.verifier import (
    VerificationError,
    build_repair_prompt,
    verify,
    verify_and_repair,
)


class SampleProposal(BaseModel):
    action: str = Field(min_length=1)
    limit: int = Field(ge=1, le=100)


def test_verify_valid_output_passes():
    valid_json = json.dumps({"action": "search_docs", "limit": 10})
    result = verify(valid_json, schema=SampleProposal)

    assert result.is_valid is True
    assert isinstance(result.data, SampleProposal)
    assert result.data.action == "search_docs"
    assert result.data.limit == 10
    assert result.errors == []


def test_verify_invalid_json_format():
    broken_json = "{bad-json: 123"
    result = verify(broken_json, schema=SampleProposal)

    assert result.is_valid is False
    assert any("Invalid JSON" in err for err in result.errors)


def test_verify_schema_failure():
    invalid_data = {"action": "search_docs", "limit": 0}
    result = verify(invalid_data, schema=SampleProposal)

    assert result.is_valid is False
    assert any("Field 'limit'" in err for err in result.errors)


def test_verify_deterministic_rules():
    no_delete_rule = lambda data: (
        "delete" not in data.action.lower(),
        "Delete operations are prohibited",
    )

    valid_proposal = SampleProposal(action="delete_all", limit=5)
    result = verify(valid_proposal, rules=[no_delete_rule])

    assert result.is_valid is False
    assert "Delete operations are prohibited" in result.errors


def test_build_repair_prompt_contains_errors():
    errors = ["Field 'limit': Input should be greater than or equal to 1"]
    prompt = build_repair_prompt(
        errors=errors,
        original_output='{"limit": 0}',
        schema=SampleProposal,
    )

    assert "Input should be greater than or equal to 1" in prompt
    assert "Expected schema" in prompt
    assert "Please fix these errors" in prompt


@pytest.mark.asyncio
async def test_verify_and_repair_recovers_on_retry():
    call_count = 0

    async def fake_llm(prompt: str) -> str:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return json.dumps({"action": "search_docs"})
        return json.dumps({"action": "search_docs", "limit": 5})

    result = await verify_and_repair(
        generate_fn=fake_llm,
        initial_prompt="Generate search parameters",
        schema=SampleProposal,
        max_retries=2,
    )

    assert call_count == 2
    assert isinstance(result, SampleProposal)
    assert result.action == "search_docs"
    assert result.limit == 5


@pytest.mark.asyncio
async def test_verify_and_repair_fails_after_max_retries():
    call_count = 0

    async def stubborn_llm(prompt: str) -> str:
        nonlocal call_count
        call_count += 1
        return json.dumps({"action": "search_docs", "limit": -99})

    with pytest.raises(VerificationError) as exc_info:
        await verify_and_repair(
            generate_fn=stubborn_llm,
            initial_prompt="Generate parameters",
            schema=SampleProposal,
            max_retries=2,
        )

    assert call_count == 3
    assert "Verification failed after 3 attempts" in str(exc_info.value)
    assert len(exc_info.value.errors) > 0
