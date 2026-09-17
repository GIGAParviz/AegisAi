import os

import pytest

from app.core.config import settings
from app.services.llm import build_llm_provider


@pytest.mark.asyncio
@pytest.mark.integration
async def test_remote_llm_complete():
    
    if not settings.run_llm_integration:
        pytest.skip(
            "LLM integration test is disabled"
        )

    if not settings.llm_api_key:
        pytest.skip(
            "LLM API key is not configured"
        )

    provider = build_llm_provider()

    result = await provider.complete(
        [
            {
                "role": "user",
                "content": (
                    "Reply only with exactly: "
                    "AegisAI online"
                ),
            }
        ],
        temperature=0,
        max_tokens=2048,
    )
    
    print("LLM response:", result)

    assert isinstance(result, str)
    assert result.strip()