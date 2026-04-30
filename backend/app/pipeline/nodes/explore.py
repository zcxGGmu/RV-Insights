"""Explorer agent node — discovers contribution opportunities via tools."""

from __future__ import annotations

import json
import re
from typing import Any

from ..stubs import _stub_exploration_result
from ._shared import close_publisher, get_publisher, logger


def _get_explorer_model_config():
    """Build a ModelConfig for the Explorer agent from settings."""
    from app.config import settings
    from app.services.model_factory import ModelConfig

    if settings.ANTHROPIC_API_KEY:
        return ModelConfig(
            provider=settings.EXPLORER_PROVIDER,
            model_name=settings.EXPLORER_MODEL,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0.4,
            context_window=200_000,
        )

    return ModelConfig(
        provider=settings.DEFAULT_LLM_PROVIDER,
        model_name=settings.DEFAULT_LLM_MODEL,
        base_url=settings.DEFAULT_LLM_BASE_URL or None,
        api_key=settings.DEFAULT_LLM_API_KEY or None,
        temperature=0.4,
        context_window=settings.DEFAULT_LLM_CONTEXT_WINDOW,
    )


def _parse_exploration_result(text: str) -> dict[str, Any]:
    """Extract JSON from LLM output and validate against ExplorationResult."""
    from app.models.schemas import ExplorationResult

    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()

    try:
        data = json.loads(cleaned)
        ExplorationResult.model_validate(data)
        return data
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("exploration_parse_failed", error=str(exc))
        return _stub_exploration_result()


async def explore_node(state: dict) -> dict:
    """Explorer agent — discovers contribution opportunities via tools."""
    case_id = state.get("case_id", "unknown")
    publisher = None

    try:
        publisher = await get_publisher()

        if publisher:
            await publisher.publish_stage_change(
                case_id, "explore", "started",
            )

        from app.adapters.langchain_adapter import LangChainReactAdapter
        from app.pipeline.cost import merge_cost
        from app.pipeline.prompts.explorer import EXPLORER_SYSTEM_PROMPT
        from app.pipeline.tools.explorer_tools import get_explorer_tools
        from app.pipeline.verification import verify_exploration_claims
        from app.services.model_factory import create_chat_model

        config = _get_explorer_model_config()
        llm = create_chat_model(config)
        tools = get_explorer_tools()

        prompt = EXPLORER_SYSTEM_PROMPT.format(
            input_context=state.get("input_context", ""),
            target_repo=state.get("target_repo", ""),
            contribution_type=state.get("contribution_type", ""),
        )

        adapter = LangChainReactAdapter(llm, tools, prompt)

        final_output = ""
        total_input_tokens = 0
        total_output_tokens = 0

        async for event in adapter.execute(
            prompt="Begin exploration.", context={},
        ):
            if publisher:
                if event.event_type == "thinking":
                    await publisher.publish_thinking(
                        case_id, event.data.get("content", ""),
                    )
                elif event.event_type == "tool_call":
                    await publisher.publish_tool_call(
                        case_id,
                        event.data.get("tool_name", ""),
                        event.data.get("args", {}),
                    )
                elif event.event_type == "tool_result":
                    await publisher.publish_tool_result(
                        case_id,
                        event.data.get("tool_name", ""),
                        event.data.get("result", ""),
                    )

            if event.event_type == "output":
                final_output = event.data.get("content", "")
            elif event.event_type == "cost_update":
                total_input_tokens = event.data.get("input_tokens", 0)
                total_output_tokens = event.data.get("output_tokens", 0)

        exploration = _parse_exploration_result(final_output)
        exploration = await verify_exploration_claims(exploration)

        new_cost = merge_cost(
            state.get("cost", {}),
            config.model_name,
            total_input_tokens,
            total_output_tokens,
        )

        if publisher:
            await publisher.publish_stage_change(
                case_id, "explore", "completed",
            )
            await publisher.publish_cost_update(case_id, new_cost)

        return {
            "current_stage": "explore",
            "status": "pending_explore_review",
            "exploration_result": exploration,
            "cost": new_cost,
            "events": [{
                "event_type": "stage_change",
                "data": {"stage": "explore", "status": "completed"},
            }],
        }

    except Exception as exc:
        logger.error(
            "explore_node_failed", case_id=case_id, error=str(exc),
        )
        if publisher:
            try:
                await publisher.publish_error(
                    case_id, str(exc), recoverable=True,
                )
            except Exception:
                pass

        return {
            "current_stage": "explore",
            "status": "pending_explore_review",
            "exploration_result": _stub_exploration_result(),
            "cost": state.get("cost", {}),
            "error": str(exc),
            "events": [{
                "event_type": "stage_change",
                "data": {"stage": "explore", "status": "failed"},
            }],
        }
    finally:
        await close_publisher(publisher)
