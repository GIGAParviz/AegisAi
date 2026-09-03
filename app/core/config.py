from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AegisAi"
    environment: str = "development"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./aegis.db"

    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"

    llm_provider: str = "orcarouter"
    llm_base_url: str = Field(default="https://api.orcarouter.ai/v1", validation_alias="PROVIDER_URL")
    llm_api_key: str = Field(default="", validation_alias="API_KEY")
    llm_model: str = Field(default="z-ai/glm-5.3-flash", validation_alias="MODEL_NAME")

    jwt_secret: str = Field(default="dev-secret-change-me", validation_alias="JWT_SECRET")
    jwt_alg: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")

    access_token_expire_min: int = Field(default=30, validation_alias="ACCESS_TOKEN_EXPIRED_MIN")
    refresh_token_expire_days: int = Field(default=7, validation_alias="REFRESH_TOKEN_EXPIRED_DAYS")
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

# class DbSettings(BaseSettings):
#     postgres_host: str = "localhost"
#     postgres_db: str = "aegisai"
#     postgres_user: str = "postgres"
#     postgres_password: str = ""
#     postgres_port: int = 5433
#     environment: str = "development"

#     model_config = SettingsConfigDict(
#         env_file=".env",
#         env_file_encoding="utf-8",
#         extra="ignore",
#     )

#     @property
#     def postgres_url(self) -> str:
#         return (
#             f"postgresql+asyncpg://"
#             f"{self.postgres_user}:{self.postgres_password}"
#             f"@{self.postgres_host}:{self.postgres_port}/"
#             f"{self.postgres_db}"
#         )