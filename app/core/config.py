from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AegisAi"
    environment: str = "development"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./aegis.db"

    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"
    
    run_llm_integration: bool = False
    
    llm_provider: str = "openai_compat"

    llm_base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        validation_alias="PROVIDER_URL",
    )

    llm_api_key: str = Field(
        default="",
        validation_alias="API_KEY",
    )

    llm_model: str = Field(
        default="nvidia/nemotron-3.5-lightning:free",
        validation_alias="MODEL_NAME",
    )

    jwt_secret: str = Field(
    default="dev-secret-change-me-at-least-32-bytes-long",
    validation_alias="JWT_SECRET",
    )
    
    jwt_alg: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")

    access_token_expire_min: int = Field(
        default=30, validation_alias="ACCESS_TOKEN_EXPIRED_MIN"
    )
    refresh_token_expire_days: int = Field(
        default=7, validation_alias="REFRESH_TOKEN_EXPIRED_DAYS"
    )
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60

    embedding_provider: str = "fake"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    embedding_base_url: str = "https://api.openai.com/v1"

    embedding_api_key: str = ""

    embedding_batch_size: int = 32

    qdrant_collection_name: str = "aegis_documents"

    embedding_dimensions: int = 384

    sparse_embedding_model: str = "Qdrant/bm25"

    hybrid_prefetch_limit: int = 20

    rerank_enabled: bool = False

    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L6-v2"

    rerank_candidates: int = 20

    rerank_batch_size: int = 16


settings = Settings()
