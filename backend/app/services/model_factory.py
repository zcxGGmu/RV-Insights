from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


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


def create_chat_model(config: ModelConfig):
    if config.provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=config.model_name,
            anthropic_api_key=config.api_key or "",
            temperature=config.temperature,
            max_tokens=config.output_reserve if hasattr(config, "output_reserve") else 4096,
        )

    from langchain_openai import ChatOpenAI
    kwargs: dict = {
        "model": config.model_name,
        "temperature": config.temperature,
        "streaming": True,
    }
    if config.api_key:
        kwargs["api_key"] = config.api_key
    if config.base_url:
        kwargs["base_url"] = config.base_url
    return ChatOpenAI(**kwargs)


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
