"""Planner agent node — designs execution plan from exploration results."""

from __future__ import annotations

import json
import re
from typing import Any

from ..stubs import _stub_execution_plan
from ._shared import close_publisher, get_publisher, logger


def _get_planner_model_config():
    """Build a ModelConfig for the Planner agent from settings."""
    from app.config import settings
    from app.services.model_factory import ModelConfig

    provider = getattr(
        settings, "PLANNER_PROVIDER", settings.DEFAULT_LLM_PROVIDER,
    )
    model = getattr(
        settings, "PLANNER_MODEL", settings.DEFAULT_LLM_MODEL,
    )

    api_key: str | None = None
    if provider == "anthropic" and settings.ANTHROPIC_API_KEY:
        api_key = settings.ANTHROPIC_API_KEY
    else:
        api_key = settings.DEFAULT_LLM_API_KEY or None

    return ModelConfig(
        provider=provider,
        model_name=model,
        base_url=settings.DEFAULT_LLM_BASE_URL or None,
        api_key=api_key,
        temperature=0.4,
        context_window=settings.DEFAULT_LLM_CONTEXT_WINDOW,
    )


def _parse_execution_plan(text: str) -> dict[str, Any]:
    """Extract JSON from LLM output and validate ExecutionPlan shape."""
    try:
        parsed = json.loads(text)
        if (
            isinstance(parsed, dict)
            and "dev_steps" in parsed
            and "test_cases" in parsed
        ):
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass

    match = re.search(
        r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL,
    )
    if match:
        try:
            parsed = json.loads(match.group(1))
            if (
                isinstance(parsed, dict)
                and "dev_steps" in parsed
                and "test_cases" in parsed
            ):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass

    logger.warning(
        "execution_plan_parse_failed", text_preview=text[:200],
    )
    return _stub_execution_plan()


def _validate_plan(plan: dict) -> dict:
    """Post-process an execution plan: fix invalid refs, clamp tokens."""
    valid_step_ids = {
        step.get("id")
        for step in plan.get("dev_steps", [])
        if step.get("id")
    }

    cleaned_steps = []
    for step in plan.get("dev_steps", []):
        deps = step.get("dependencies", [])
        cleaned_deps = [
            d for d in deps
            if d in valid_step_ids and d != step.get("id")
        ]
        cleaned_steps.append({**step, "dependencies": cleaned_deps})

    est = plan.get("estimated_tokens", 0)
    if (
        not isinstance(est, (int, float))
        or est <= 0
        or est > 1_000_000
    ):
        est = 50_000

    return {
        **plan,
        "dev_steps": cleaned_steps,
        "estimated_tokens": int(est),
    }


async def plan_node(state: dict) -> dict:
    """Planner agent — designs execution plan from exploration results."""
    case_id = state.get("case_id", "unknown")
    publisher = None

    try:
        publisher = await get_publisher()

        if publisher:
            await publisher.publish_stage_change(
                case_id, "plan", "started",
            )
            await publisher.publish_thinking(
                case_id,
                "Analyzing exploration results and designing "
                "execution plan...",
            )

        from langchain_core.messages import HumanMessage, SystemMessage

        from app.pipeline.cost import merge_cost
        from app.pipeline.prompts.planner import PLANNER_SYSTEM_PROMPT
        from app.services.model_factory import create_chat_model

        config = _get_planner_model_config()
        llm = create_chat_model(config)

        exploration_json = json.dumps(
            state.get("exploration_result", {}), indent=2,
        )
        prompt = PLANNER_SYSTEM_PROMPT.format(
            exploration_result_json=exploration_json,
        )

        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content="Generate the execution plan."),
        ]
        response = await llm.ainvoke(messages)

        input_tokens = 0
        output_tokens = 0
        if (
            hasattr(response, "usage_metadata")
            and response.usage_metadata
        ):
            input_tokens = (
                getattr(response.usage_metadata, "input_tokens", 0)
                or 0
            )
            output_tokens = (
                getattr(response.usage_metadata, "output_tokens", 0)
                or 0
            )

        raw_content = (
            response.content
            if isinstance(response.content, str)
            else str(response.content)
        )
        plan = _parse_execution_plan(raw_content)
        plan = _validate_plan(plan)

        new_cost = merge_cost(
            state.get("cost", {}),
            config.model_name,
            input_tokens,
            output_tokens,
        )

        if publisher:
            await publisher.publish_stage_change(
                case_id, "plan", "completed",
            )
            await publisher.publish_cost_update(case_id, new_cost)

        return {
            "current_stage": "plan",
            "status": "pending_plan_review",
            "execution_plan": plan,
            "cost": new_cost,
            "events": [{
                "event_type": "stage_change",
                "data": {"stage": "plan", "status": "completed"},
            }],
        }

    except Exception as exc:
        logger.error(
            "plan_node_failed", case_id=case_id, error=str(exc),
        )
        if publisher:
            try:
                await publisher.publish_error(
                    case_id,
                    f"Planner failed: {exc!s}",
                    recoverable=True,
                )
            except Exception:
                pass

        return {
            "current_stage": "plan",
            "status": "pending_plan_review",
            "execution_plan": _stub_execution_plan(),
            "error": str(exc),
            "events": [{
                "event_type": "error",
                "data": {"message": str(exc)},
            }],
        }
    finally:
        await close_publisher(publisher)
