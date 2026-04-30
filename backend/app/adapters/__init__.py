from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any

from pydantic import BaseModel


class AgentEvent(BaseModel):
    """Unified event envelope for pipeline agent streaming."""

    event_type: str  # thinking | tool_call | tool_result | output | error | cost_update
    data: dict[str, Any]


class AgentAdapter(ABC):
    """Abstract base class for pipeline agent adapters."""

    @abstractmethod
    async def execute(
        self,
        prompt: str,
        context: dict[str, Any],
    ) -> AsyncIterator[AgentEvent]:
        ...

    @abstractmethod
    async def cancel(self) -> None:
        ...


__all__ = ["AgentAdapter", "AgentEvent"]
