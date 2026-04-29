from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ModelConfigInDB(BaseModel):
    id: str
    name: str
    provider: str = "openai"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: str = "gpt-4o"
    context_window: int = 128000
    temperature: float = 0.7
    is_system: bool = False
    is_active: bool = True
    user_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CreateModelRequest(BaseModel):
    name: str = Field(max_length=100)
    provider: str = "openai"
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: str
    context_window: Optional[int] = Field(None, ge=1024, le=10_000_000)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)

    model_config = {"extra": "forbid"}


class UpdateModelRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    context_window: Optional[int] = Field(None, ge=1024, le=10_000_000)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    is_active: Optional[bool] = None

    model_config = {"extra": "forbid"}


class DetectContextWindowRequest(BaseModel):
    provider: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: str

    model_config = {"extra": "forbid"}


class ModelConfigResponse(BaseModel):
    id: str
    name: str
    provider: str
    base_url: Optional[str] = None
    api_key_set: bool = False
    model_name: str
    context_window: int
    temperature: float
    is_system: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
