from app.core.config import Settings


def test_settings_defaults():
    settings = Settings(_env_file=None)

    assert settings.database_url == "sqlite+aiosqlite:///./aegis.db"
    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.qdrant_url == "http://localhost:6333"
    assert settings.llm_provider == "openai_compat"
    assert settings.llm_base_url == "https://openrouter.ai/api/v1"
    assert settings.llm_api_key == ""
    assert settings.llm_model == "nvidia/nemotron-3.5-lightning:free"
    assert settings.jwt_secret == "dev-secret-change-me-at-least-32-bytes-long"
    assert settings.jwt_alg == "HS256"
    assert settings.access_token_expire_min == 30
    assert settings.embedding_provider == "fake"


def test_env_overrides_settings(monkeypatch):
    monkeypatch.setenv("PROVIDER_URL", "http://localhost:8000/v1")
    monkeypatch.setenv("MODEL_NAME", "test-model")
    monkeypatch.setenv("API_KEY", "test-key")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRED_MIN", "120")

    settings = Settings(_env_file=None)

    assert settings.llm_base_url == "http://localhost:8000/v1"
    assert settings.llm_model == "test-model"
    assert settings.llm_api_key == "test-key"
    assert settings.access_token_expire_min == 120
