from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Basic app info
    APP_NAME: str = "RV-Insights"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Databases / Caches
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "rv_insights"

    POSTGRES_URI: str = "postgresql://postgres:postgres@localhost:5432/rv_insights"

    REDIS_URI: str = "redis://localhost:6379/0"

    # JWT / security
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Pipeline / MVP limits
    MAX_REVIEW_ITERATIONS: int = 3
    MAX_COST_PER_CASE: float = 10.0

    # Load from .env file
    model_config = SettingsConfigDict(env_file=".env")


# Singleton settings instance used across the app
settings = Settings()
