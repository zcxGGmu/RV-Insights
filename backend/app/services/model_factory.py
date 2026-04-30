from __future__ import annotations

from typing import Any, Optional

import structlog
from pydantic import BaseModel

logger = structlog.get_logger()

DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

KNOWN_CONTEXT_WINDOWS: dict[str, int] = {
    "gpt-4o": 128000,
    "gpt-4o-mini": 128000,
    "gpt-4-turbo": 128000,
    "gpt-3.5-turbo": 16385,
    "claude-3-5-sonnet-20241022": 200000,
    "claude-3-5-haiku-20241022": 200000,
    "claude-sonnet-4-20250514": 200000,
    "claude-3-opus-20240229": 200000,
    "deepseek-chat": 64000,
    "deepseek-coder": 64000,
    "deepseek-reasoner": 64000,
}


class ModelConfig(BaseModel):
    provider: str = "openai"
    model_name: str = "gpt-4o"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    temperature: float = 0.7
    context_window: int = 128000


class TaskSettings(BaseModel):
    max_history_rounds: int = 10
    output_reserve: int = 16384
    agent_stream_timeout: int = 10800
    queue_maxsize: int = 256


def create_chat_model(config: ModelConfig) -> Any:
    import os

    if config.provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        if config.api_key:
            os.environ.setdefault("ANTHROPIC_API_KEY", config.api_key)
        return ChatAnthropic(
            model=config.model_name,
            anthropic_api_key=config.api_key or "",
            temperature=config.temperature,
            max_tokens=4096,
        )

    from langchain_openai import ChatOpenAI
    if config.api_key:
        os.environ.setdefault("OPENAI_API_KEY", config.api_key)
    kwargs: dict[str, Any] = {
        "model": config.model_name,
        "temperature": config.temperature,
        "streaming": True,
    }
    if config.api_key:
        kwargs["api_key"] = config.api_key
    if config.base_url:
        kwargs["base_url"] = config.base_url
    elif config.provider == "deepseek":
        kwargs["base_url"] = DEEPSEEK_BASE_URL
    return ChatOpenAI(**kwargs)


async def resolve_model_config(
    model_config_id: Optional[str],
    user_id: str,
    db: Any,
) -> ModelConfig:
    if model_config_id and db and db.mongo_db:
        col = db.mongo_db["model_configs"]
        doc = await col.find_one({
            "id": model_config_id,
            "$or": [{"user_id": user_id}, {"is_system": True}],
            "is_active": True,
        })
        if doc:
            return ModelConfig(
                provider=doc.get("provider", "openai"),
                model_name=doc.get("model_name", "gpt-4o"),
                base_url=doc.get("base_url"),
                api_key=doc.get("api_key"),
                temperature=doc.get("temperature", 0.7),
                context_window=doc.get("context_window", 128000),
            )
        logger.warning("model_config_not_found", model_config_id=model_config_id)

    return get_default_model_config()


async def verify_model_connection(config: ModelConfig) -> bool:
    try:
        llm = create_chat_model(config)
        from langchain_core.messages import HumanMessage
        response = await llm.ainvoke([HumanMessage(content="Hi")])
        return bool(response.content)
    except Exception as exc:
        logger.warning("model_verification_failed", error=str(exc))
        return False


def detect_context_window(model_name: str) -> Optional[int]:
    return KNOWN_CONTEXT_WINDOWS.get(model_name)


def get_default_model_config() -> ModelConfig:
    from app.config import settings
    return ModelConfig(
        provider=settings.DEFAULT_LLM_PROVIDER,
        model_name=settings.DEFAULT_LLM_MODEL,
        base_url=settings.DEFAULT_LLM_BASE_URL or None,
        api_key=settings.DEFAULT_LLM_API_KEY or None,
        temperature=settings.DEFAULT_LLM_TEMPERATURE,
        context_window=settings.DEFAULT_LLM_CONTEXT_WINDOW,
    )


def get_default_task_settings() -> TaskSettings:
    from app.config import settings
    return TaskSettings(
        agent_stream_timeout=settings.AGENT_STREAM_TIMEOUT,
        queue_maxsize=settings.AGENT_QUEUE_MAXSIZE,
    )
