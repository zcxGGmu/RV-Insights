from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "RV-Insights"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "rv_insights"

    POSTGRES_URI: str = "postgresql://postgres:postgres@localhost:5432/rv_insights"

    REDIS_URI: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    MAX_REVIEW_ITERATIONS: int = 3
    MAX_COST_PER_CASE: float = 10.0

    DEFAULT_LLM_PROVIDER: str = "openai"
    DEFAULT_LLM_MODEL: str = "gpt-4o"
    DEFAULT_LLM_BASE_URL: str = ""
    DEFAULT_LLM_API_KEY: str = ""
    DEFAULT_LLM_TEMPERATURE: float = 0.7
    DEFAULT_LLM_CONTEXT_WINDOW: int = 128000

    AGENT_MAX_CONCURRENCY: int = 10
    AGENT_STREAM_TIMEOUT: int = 10800
    AGENT_QUEUE_MAXSIZE: int = 256

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10_485_760

    SEARCH_API_KEY: str = ""
    SEARCH_API_URL: str = ""

    ANTHROPIC_API_KEY: str = ""
    EXPLORER_MODEL: str = "claude-sonnet-4-20250514"
    EXPLORER_PROVIDER: str = "anthropic"
    PLANNER_MODEL: str = "gpt-4o"
    PLANNER_PROVIDER: str = "openai"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
