from app.core.config import Settings


def test_settings_defaults():
    settings = Settings(_env_file=None)

    assert settings.database_url == "sqlite+aiosqlite:///./aegis.db"
    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.qdrant_url == "http://localhost:6333"
    assert settings.llm_provider == "orcarouter"
    assert settings.llm_base_url == "https://api.orcarouter.ai/v1"
    assert settings.llm_api_key == ""
    assert settings.llm_model == "z-ai/glm-5.3-flash"
    assert settings.jwt_secret == "dev-secret-change-me"
    assert settings.jwt_alg == "HS256"
    assert settings.access_token_expire_min == 30


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