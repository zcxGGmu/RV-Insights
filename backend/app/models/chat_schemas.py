from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"


class ChatEvent(BaseModel):
    event_id: str
    timestamp: float
    type: str
    data: dict[str, Any] = Field(default_factory=dict)


class ToolCallRecord(BaseModel):
    tool_call_id: str
    name: str
    args: dict[str, Any] = Field(default_factory=dict)
    result: Optional[Any] = None
    duration_ms: Optional[int] = None


class ChatMessage(BaseModel):
    event_id: str
    role: Literal["user", "assistant"]
    content: str
    attachments: list[str] = Field(default_factory=list)
    tool_calls: list[ToolCallRecord] = Field(default_factory=list)
    timestamp: float


class ChatSessionInDB(BaseModel):
    session_id: str
    user_id: str
    title: Optional[str] = None
    status: SessionStatus = SessionStatus.PENDING
    mode: str = "chat"
    model_config_id: Optional[str] = None
    events: list[ChatEvent] = Field(default_factory=list)
    pinned: bool = False
    is_shared: bool = False
    latest_message: Optional[str] = None
    latest_message_at: Optional[float] = None
    unread_message_count: int = 0
    source: Optional[Literal["wechat", "lark"]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}


# --- Request models ---

class CreateSessionRequest(BaseModel):
    mode: str = "chat"
    model_config_id: Optional[str] = None

    model_config = {"extra": "forbid"}


class UpdateSessionTitleRequest(BaseModel):
    title: str = Field(max_length=200)

    model_config = {"extra": "forbid"}


class UpdateSessionPinRequest(BaseModel):
    pinned: bool

    model_config = {"extra": "forbid"}


# --- Response models ---

class ListSessionItem(BaseModel):
    session_id: str
    title: Optional[str] = None
    latest_message: Optional[str] = None
    latest_message_at: Optional[float] = None
    status: SessionStatus
    unread_message_count: int = 0
    is_shared: bool = False
    mode: str = "chat"
    pinned: bool = False
    source: Optional[Literal["wechat", "lark"]] = None


class ListSessionData(BaseModel):
    sessions: list[ListSessionItem]


class GetSessionData(BaseModel):
    session_id: str
    title: Optional[str] = None
    status: SessionStatus
    events: list[ChatEvent] = Field(default_factory=list)
    is_shared: bool = False
    mode: str = "chat"
    model_config_id: Optional[str] = None
