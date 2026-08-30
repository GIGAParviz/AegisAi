from pydantic_settings import SettingsConfigDict, BaseSettings

class Settings(BaseSettings):
    app_name: str = "AegisAi"
    environment: str = "development"
    debug: bool = False
    
    model_config = SettingsConfigDict(
        env_file= ".env",
        extra="ignore",
        env_file_encoding="utf-8"
    ) 
    
    
settings = Settings()
