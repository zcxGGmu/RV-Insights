from __future__ import annotations

import time
from typing import Any, AsyncGenerator, Optional

import shortuuid
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage

from app.models.chat_schemas import ChatEvent, ChatSessionInDB
from app.prompts import RISC_V_EXPERT_SYSTEM_PROMPT
from app.services.model_factory import ModelConfig, TaskSettings, create_chat_model


def _estimate_tokens(text: str) -> int:
    return max(1, int(len(text) / 1.5))


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "...[truncated]"


def _build_history_messages(
    events: list[ChatEvent],
    max_rounds: int,
    token_budget: int,
) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    rounds: list[list[BaseMessage]] = []
    current_round: list[BaseMessage] = []

    for ev in events:
        if ev.type == "message":
            role = ev.data.get("role", "user")
            content = ev.data.get("content", "")
            if role == "user":
                if current_round:
                    rounds.append(current_round)
                    current_round = []
                current_round.append(HumanMessage(content=content))
            elif role == "assistant":
                content = _truncate(content, 3000)
                current_round.append(AIMessage(content=content))
        elif ev.type == "tool" and ev.data.get("status") == "called":
            content = str(ev.data.get("content", ""))
            content = _truncate(content, 2000)
            tool_call_id = ev.data.get("tool_call_id", "")
            current_round.append(
                ToolMessage(content=content, tool_call_id=tool_call_id)
            )

    if current_round:
        rounds.append(current_round)

    recent_rounds = rounds[-max_rounds:]

    total_tokens = 0
    selected: list[list[BaseMessage]] = []
    for r in reversed(recent_rounds):
        round_tokens = sum(_estimate_tokens(m.content) for m in r if isinstance(m.content, str))
        if total_tokens + round_tokens > token_budget and selected:
            break
        selected.append(r)
        total_tokens += round_tokens

    selected.reverse()
    for r in selected:
        messages.extend(r)

    return messages


class ChatRunner:
    def __init__(
        self,
        session: ChatSessionInDB,
        model_config: ModelConfig,
        task_settings: TaskSettings,
        memory_content: Optional[str] = None,
    ):
        self._session = session
        self._model_config = model_config
        self._task_settings = task_settings
        self._memory_content = memory_content
        self._is_cancelled = False
        self._start_time = 0.0
        self._input_tokens = 0
        self._output_tokens = 0
        self._tool_call_count = 0

    def cancel(self) -> None:
        self._is_cancelled = True

    async def astream(
        self,
        query: str,
        attachments: Optional[list[str]] = None,
        language: str = "zh",
    ) -> AsyncGenerator[dict[str, Any], None]:
        self._start_time = time.time()

        system_prompt = RISC_V_EXPERT_SYSTEM_PROMPT
        if self._memory_content:
            system_prompt += f"\n\n## User Preferences\n{self._memory_content[:4000]}"

        token_budget = int(self._model_config.context_window * 0.85)
        token_budget -= self._task_settings.output_reserve
        token_budget -= _estimate_tokens(system_prompt)
        token_budget -= _estimate_tokens(query)
        token_budget = max(token_budget, 8000)

        history = _build_history_messages(
            self._session.events,
            self._task_settings.max_history_rounds,
            token_budget,
        )

        messages: list[BaseMessage] = [
            SystemMessage(content=system_prompt),
            *history,
            HumanMessage(content=query),
        ]

        llm = create_chat_model(self._model_config)

        event_id = shortuuid.uuid()
        accumulated_content = ""

        try:
            async for chunk in llm.astream(messages):
                if self._is_cancelled:
                    yield self._make_event("error", {"error": "Cancelled by user"})
                    break

                if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                    meta = chunk.usage_metadata
                    self._input_tokens += getattr(meta, "input_tokens", 0) or 0
                    self._output_tokens += getattr(meta, "output_tokens", 0) or 0

                content = ""
                if isinstance(chunk.content, str):
                    content = chunk.content
                elif isinstance(chunk.content, list):
                    for block in chunk.content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            content += block.get("text", "")

                if content:
                    accumulated_content += content
                    yield self._make_event("message_chunk", {
                        "event_id": event_id,
                        "content": content,
                        "role": "assistant",
                    })

            if not self._is_cancelled and accumulated_content:
                yield self._make_event("message_chunk_done", {
                    "event_id": event_id,
                })

        except Exception as exc:
            yield self._make_event("error", {"error": str(exc)})

        duration_ms = int((time.time() - self._start_time) * 1000)
        stats = {
            "total_duration_ms": duration_ms,
            "tool_call_count": self._tool_call_count,
            "input_tokens": self._input_tokens,
            "output_tokens": self._output_tokens,
            "token_count": self._input_tokens + self._output_tokens,
        }
        yield self._make_event("done", {
            "statistics": stats,
            "interrupted": self._is_cancelled,
        })

    def _make_event(self, event_type: str, data: dict[str, Any]) -> dict[str, Any]:
        return {
            "event": event_type,
            "data": {
                "event_id": data.get("event_id", shortuuid.uuid()),
                "timestamp": time.time(),
                **data,
            },
        }
