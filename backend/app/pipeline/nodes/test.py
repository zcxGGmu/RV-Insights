"""Tester agent node — evaluates code patches against the test plan."""

from __future__ import annotations

import json
import re
from typing import Any

from ..stubs import _stub_test_result
from ._shared import close_publisher, get_publisher, logger


def _get_tester_model_config():
    """Build a ModelConfig for the Tester agent from settings."""
    from app.config import settings
    from app.services.model_factory import ModelConfig

    provider = getattr(
        settings, "TESTER_PROVIDER", settings.DEFAULT_LLM_PROVIDER,
    )
    model = getattr(
        settings, "TESTER_MODEL", settings.DEFAULT_LLM_MODEL,
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
        temperature=0.2,
        context_window=settings.DEFAULT_LLM_CONTEXT_WINDOW,
    )


def _format_patch_content(dev_result: dict) -> str:
    """Concatenate all patch diffs for the tester prompt."""
    patches = dev_result.get("patches", {})
    if not patches:
        changed = dev_result.get("changed_files", [])
        return f"(No detailed patches available. Changed files: {changed})"

    parts: list[str] = []
    for filename, patch in patches.items():
        diff = patch.get("diff_content", "") if isinstance(patch, dict) else ""
        if diff:
            parts.append(f"--- {filename} ---\n{diff}")
        else:
            modified = patch.get("modified_content", "") if isinstance(patch, dict) else ""
            if modified:
                parts.append(f"--- {filename} (full content) ---\n{modified[:6000]}")
    return "\n\n".join(parts) if parts else "(Patch content empty.)"


def _parse_test_result(text: str) -> dict[str, Any]:
    """Extract JSON from LLM output and validate TestResult shape."""
    from app.models.schemas import TestResult

    stripped = text.strip()

    # Attempt 1: raw text is valid JSON
    try:
        data = json.loads(stripped)
        TestResult.model_validate(data)
        return data
    except (json.JSONDecodeError, Exception):
        pass

    # Attempt 2: extract from outermost markdown fence
    match = re.search(
        r"```(?:json)?\s*\n(.*)\n```\s*$", stripped, re.DOTALL,
    )
    if match:
        try:
            data = json.loads(match.group(1))
            TestResult.model_validate(data)
            return data
        except (json.JSONDecodeError, Exception) as exc:
            logger.warning(
                "test_result_parse_failed", error=str(exc),
            )

    return _stub_test_result()


async def test_node(state: dict) -> dict:
    """Tester agent — evaluates patches against the execution plan test cases."""
    case_id = state.get("case_id", "unknown")
    publisher = None

    try:
        publisher = await get_publisher()

        if publisher:
            await publisher.publish_stage_change(
                case_id, "test", "started",
            )
            await publisher.publish_thinking(
                case_id,
                "Running compilation checks and test case evaluation...",
            )

        from langchain_core.messages import HumanMessage, SystemMessage

        from app.pipeline.cost import merge_cost
        from app.pipeline.prompts.tester import TESTER_SYSTEM_PROMPT
        from app.services.model_factory import create_chat_model

        config = _get_tester_model_config()
        llm = create_chat_model(config)

        execution_plan = state.get("execution_plan", {}) or {}
        dev_result = state.get("development_result", {}) or {}
        commit_message = dev_result.get("commit_message", "N/A")
        target_repo = state.get("target_repo", "unknown")

        prompt = TESTER_SYSTEM_PROMPT.format(
            execution_plan_json=json.dumps(execution_plan, indent=2),
            patch_content=_format_patch_content(dev_result),
            commit_message=commit_message,
            target_repo=target_repo,
        )

        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content="Evaluate the patches and provide your test results."),
        ]
        response = await llm.ainvoke(messages)

        input_tokens = 0
        output_tokens = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, "input_tokens", 0) or 0
            output_tokens = getattr(response.usage_metadata, "output_tokens", 0) or 0

        raw_content = (
            response.content
            if isinstance(response.content, str)
            else str(response.content)
        )

        result = _parse_test_result(raw_content)

        new_cost = merge_cost(
            state.get("cost", {}),
            config.model_name,
            input_tokens,
            output_tokens,
        )

        if publisher:
            await publisher.publish_stage_change(
                case_id, "test", "completed",
            )
            await publisher.publish_cost_update(case_id, new_cost)

        return {
            "current_stage": "test",
            "status": "pending_test_review",
            "test_result": result,
            "cost": new_cost,
            "events": [{
                "event_type": "stage_change",
                "data": {"stage": "test", "status": "completed"},
            }],
        }

    except Exception as exc:
        logger.error(
            "test_node_failed", case_id=case_id, error=str(exc),
            exc_info=True,
        )
        safe_msg = "Tester agent encountered an internal error."
        if publisher:
            try:
                await publisher.publish_error(
                    case_id, safe_msg, recoverable=True,
                )
            except Exception:
                pass

        return {
            "current_stage": "test",
            "status": "pending_test_review",
            "test_result": _stub_test_result(),
            "cost": state.get("cost", {}),
            "error": safe_msg,
            "events": [{
                "event_type": "error",
                "data": {"message": safe_msg},
            }],
        }
    finally:
        await close_publisher(publisher)
