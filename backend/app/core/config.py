from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "sqlite:///./dispatchgrid.db"
    cors_origins: str = "http://localhost:5173"
    app_name: str = "DispatchGrid API"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
