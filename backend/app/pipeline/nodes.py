"""Pipeline node functions for the LangGraph state machine."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

import structlog

from .state import PipelineState
from .stubs import (
    _stub_development_result,
    _stub_execution_plan,
    _stub_exploration_result,
    _stub_review_verdict,
    _stub_test_result,
)

try:
    from langgraph.types import interrupt
except Exception:
    def interrupt(_prompt):  # type: ignore[misc]
        return {"action": "approve", "comment": "auto-approve (fallback)"}

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _get_publisher():
    """Return an EventPublisher connected to Redis, or None if unavailable."""
    try:
        import redis.asyncio as aioredis

        from app.config import settings
        from app.pipeline.events import EventPublisher

        r = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
        # Verify connection is alive
        await r.ping()
        return EventPublisher(r)
    except Exception:
        return None


async def _close_publisher(publisher) -> None:
    """Gracefully close the Redis client inside a publisher."""
    if publisher is None:
        return
    try:
        await publisher.redis.aclose()
    except Exception:
        pass


def _get_explorer_model_config():
    """Build a ModelConfig for the Explorer agent from settings."""
    from app.config import settings
    from app.services.model_factory import ModelConfig

    # Prefer Anthropic if API key is set
    if settings.ANTHROPIC_API_KEY:
        return ModelConfig(
            provider=settings.EXPLORER_PROVIDER,
            model_name=settings.EXPLORER_MODEL,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0.4,
            context_window=200_000,
        )

    # Fallback to default LLM
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

    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()

    try:
        data = json.loads(cleaned)
        # Validate with Pydantic (raises on bad shape)
        ExplorationResult.model_validate(data)
        return data
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("exploration_parse_failed", error=str(exc))
        return _stub_exploration_result()


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

    # Use provider-specific key when available
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
    # 1. Try direct parse
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

    # 2. Try extracting from markdown code fences
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

    # Rebuild steps with cleaned dependency references (immutable)
    cleaned_steps = []
    for step in plan.get("dev_steps", []):
        deps = step.get("dependencies", [])
        cleaned_deps = [
            d for d in deps
            if d in valid_step_ids and d != step.get("id")
        ]
        cleaned_steps.append({**step, "dependencies": cleaned_deps})

    # Clamp estimated_tokens to a sane range
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


# ---------------------------------------------------------------------------
# Legacy publish helper (used by stub nodes)
# ---------------------------------------------------------------------------

async def _publish(case_id: str, event_type: str, data: dict) -> None:
    """Fire-and-forget event publish (creates a short-lived Redis connection)."""
    try:
        import redis.asyncio as aioredis

        from app.config import settings
        from app.models.schemas import EventType
        from app.pipeline.events import EventPublisher

        r = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
        pub = EventPublisher(r)
        et = (
            EventType(event_type)
            if event_type in {e.value for e in EventType}
            else EventType.agent_output
        )
        await pub.publish(case_id, et, data)
        await r.aclose()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Real node: explore
# ---------------------------------------------------------------------------

async def explore_node(state: PipelineState) -> dict:
    """Explorer agent — discovers contribution opportunities via tools."""
    case_id = state.get("case_id", "unknown")
    publisher = None

    try:
        publisher = await _get_publisher()

        # Publish stage start
        if publisher:
            await publisher.publish_stage_change(case_id, "explore", "started")

        # Build LLM + tools + prompt
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

        async for event in adapter.execute(prompt="Begin exploration.", context={}):
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

        # Parse and verify
        exploration = _parse_exploration_result(final_output)
        exploration = await verify_exploration_claims(exploration)

        # Cost accounting
        new_cost = merge_cost(
            state.get("cost", {}),
            config.model_name,
            total_input_tokens,
            total_output_tokens,
        )

        # Publish completion
        if publisher:
            await publisher.publish_stage_change(case_id, "explore", "completed")
            await publisher.publish_cost_update(case_id, new_cost)

        return {
            "current_stage": "explore",
            "status": "pending_explore_review",
            "exploration_result": exploration,
            "cost": new_cost,
            "events": [
                {
                    "event_type": "stage_change",
                    "data": {"stage": "explore", "status": "completed"},
                },
            ],
        }

    except Exception as exc:
        logger.error("explore_node_failed", case_id=case_id, error=str(exc))
        if publisher:
            try:
                await publisher.publish_error(case_id, str(exc), recoverable=True)
            except Exception:
                pass

        return {
            "current_stage": "explore",
            "status": "pending_explore_review",
            "exploration_result": _stub_exploration_result(),
            "cost": state.get("cost", {}),
            "error": str(exc),
            "events": [
                {
                    "event_type": "stage_change",
                    "data": {"stage": "explore", "status": "failed"},
                },
            ],
        }
    finally:
        await _close_publisher(publisher)


# ---------------------------------------------------------------------------
# Real node: plan
# ---------------------------------------------------------------------------

async def plan_node(state: PipelineState) -> dict:
    """Planner agent — designs execution plan from exploration results."""
    case_id = state.get("case_id", "unknown")
    publisher = None

    try:
        publisher = await _get_publisher()

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

        # Track tokens
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

        # Parse response
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
            "events": [
                {
                    "event_type": "stage_change",
                    "data": {"stage": "plan", "status": "completed"},
                },
            ],
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
            "events": [
                {
                    "event_type": "error",
                    "data": {"message": str(exc)},
                },
            ],
        }
    finally:
        await _close_publisher(publisher)


# ---------------------------------------------------------------------------
# Stub nodes: develop, review, test
# ---------------------------------------------------------------------------

async def develop_node(state: PipelineState) -> dict:
    case_id = state.get("case_id", "unknown")
    await _publish(
        case_id, "agent_output",
        {"type": "thinking", "content": "Generating code changes..."},
    )
    await asyncio.sleep(0.5)
    await _publish(
        case_id, "stage_change", {"stage": "develop", "status": "completed"},
    )
    return {
        "current_stage": "develop",
        "status": "reviewing",
        "development_result": _stub_development_result(),
        "events": [
            {"event_type": "stage_change", "data": {"stage": "develop", "status": "completed"}},
        ],
    }


async def review_node(state: PipelineState) -> dict:
    case_id = state.get("case_id", "unknown")
    await _publish(
        case_id, "agent_output",
        {"type": "thinking", "content": "Reviewing code for correctness and style..."},
    )
    await asyncio.sleep(0.5)
    iter_num = int(state.get("review_iterations", 0)) + 1
    await _publish(
        case_id, "stage_change", {"stage": "review", "status": "completed"},
    )
    return {
        "current_stage": "review",
        "status": "pending_code_review",
        "review_verdict": _stub_review_verdict(iter_num),
        "review_iterations": iter_num,
        "events": [
            {"event_type": "stage_change", "data": {"stage": "review", "status": "completed"}},
        ],
    }


async def test_node(state: PipelineState) -> dict:
    case_id = state.get("case_id", "unknown")
    await _publish(
        case_id, "agent_output",
        {"type": "thinking", "content": "Running tests and compilation checks..."},
    )
    await asyncio.sleep(0.5)
    await _publish(
        case_id, "stage_change", {"stage": "test", "status": "completed"},
    )
    return {
        "current_stage": "test",
        "status": "pending_test_review",
        "test_result": _stub_test_result(),
        "events": [
            {"event_type": "stage_change", "data": {"stage": "test", "status": "completed"}},
        ],
    }


# ---------------------------------------------------------------------------
# Routing / human gate
# ---------------------------------------------------------------------------

def human_gate_node(state: PipelineState) -> dict:
    """Human gate that pauses pipeline for human decision."""
    decision = interrupt({
        "type": "review_request",
        "stage": state.get("current_stage"),
        "iteration": state.get("review_iterations", 0),
    })
    action = decision.get("action", decision) if isinstance(decision, dict) else decision
    comment = decision.get("comment", "") if isinstance(decision, dict) else ""
    return {
        "human_decision": action,
        "human_comment": comment,
    }


def route_human_decision(state: PipelineState) -> str:
    """Route based on human decision after gate."""
    decision = state.get("human_decision", "approve")
    if decision == "abandon":
        return "end"
    if decision == "reject":
        return "reject"
    return "approve"


def route_review_decision(state: PipelineState) -> str:
    """Route after automated review: approve or loop back to develop."""
    verdict = state.get("review_verdict", {}) or {}
    if isinstance(verdict, dict) and verdict.get("approved", False):
        return "approve"
    try:
        from app.config import settings
        max_iter = getattr(settings, "MAX_REVIEW_ITERATIONS", 3)
    except Exception:
        max_iter = 3
    if state.get("review_iterations", 0) >= max_iter:
        return "escalate"
    return "reject"
