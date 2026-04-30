from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import structlog
from langchain_core.messages import AIMessageChunk, HumanMessage, SystemMessage

from app.adapters import AgentAdapter, AgentEvent

logger = structlog.get_logger()


def _truncate(text: str, limit: int = 3000) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "...[truncated]"


class LangChainReactAdapter(AgentAdapter):
    """Adapter wrapping LangGraph create_react_agent + astream_events(v2).

    Follows the event mapping pattern from ChatRunner._stream_with_tools.
    """

    def __init__(
        self,
        llm: Any,
        tools: list,
        system_prompt: str,
        max_turns: int = 30,
    ):
        self._llm = llm
        self._tools = tools
        self._system_prompt = system_prompt
        self._max_turns = max_turns
        self._is_cancelled = False
        self._input_tokens = 0
        self._output_tokens = 0

    async def execute(
        self,
        prompt: str,
        context: dict[str, Any],
    ) -> AsyncIterator[AgentEvent]:
        from langgraph.prebuilt import create_react_agent

        agent = create_react_agent(self._llm, self._tools)

        messages = [
            SystemMessage(content=self._system_prompt),
            HumanMessage(content=prompt),
        ]

        accumulated_content = ""

        try:
            async for event in agent.astream_events(
                {"messages": messages},
                version="v2",
            ):
                if self._is_cancelled:
                    yield AgentEvent(
                        event_type="error",
                        data={"error": "Cancelled by user"},
                    )
                    break

                kind = event.get("event", "")

                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if not isinstance(chunk, AIMessageChunk):
                        continue

                    self._track_usage(chunk)

                    if chunk.tool_call_chunks:
                        continue

                    content = self._extract_content(chunk)
                    if content:
                        accumulated_content += content
                        yield AgentEvent(
                            event_type="thinking",
                            data={"content": content},
                        )

                elif kind == "on_tool_start":
                    tool_name = event.get("name", "")
                    tool_input = event.get("data", {}).get("input", {})
                    yield AgentEvent(
                        event_type="tool_call",
                        data={"tool_name": tool_name, "args": tool_input},
                    )

                elif kind == "on_tool_end":
                    output = event.get("data", {}).get("output", "")
                    content_str = (
                        output.content
                        if hasattr(output, "content")
                        else str(output)
                    )
                    yield AgentEvent(
                        event_type="tool_result",
                        data={
                            "tool_name": event.get("name", ""),
                            "result": _truncate(content_str),
                        },
                    )

        except Exception as exc:
            logger.error("langchain_adapter_error", error=str(exc))
            yield AgentEvent(
                event_type="error",
                data={"error": str(exc)},
            )

        yield AgentEvent(
            event_type="output",
            data={"content": accumulated_content},
        )
        yield AgentEvent(
            event_type="cost_update",
            data={
                "input_tokens": self._input_tokens,
                "output_tokens": self._output_tokens,
            },
        )

    async def cancel(self) -> None:
        self._is_cancelled = True

    def _track_usage(self, chunk: Any) -> None:
        if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
            meta = chunk.usage_metadata
            self._input_tokens += getattr(meta, "input_tokens", 0) or 0
            self._output_tokens += getattr(meta, "output_tokens", 0) or 0

    def _extract_content(self, chunk: Any) -> str:
        content = ""
        if isinstance(chunk.content, str):
            content = chunk.content
        elif isinstance(chunk.content, list):
            for block in chunk.content:
                if isinstance(block, dict) and block.get("type") == "text":
                    content += block.get("text", "")
        return content
