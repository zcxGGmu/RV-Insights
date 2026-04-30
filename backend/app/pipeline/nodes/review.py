"""Reviewer agent node — validates code patches against execution plan."""

from __future__ import annotations

import json
import re
from typing import Any

from ..stubs import _stub_review_verdict
from ._shared import close_publisher, get_publisher, logger


def _get_reviewer_model_config():
    """Build a ModelConfig for the Reviewer agent from settings."""
    from app.config import settings
    from app.services.model_factory import ModelConfig

    provider = getattr(
        settings, "REVIEWER_PROVIDER", settings.DEFAULT_LLM_PROVIDER,
    )
    model = getattr(
        settings, "REVIEWER_MODEL", settings.DEFAULT_LLM_MODEL,
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
    """Concatenate all patch diffs into a readable review string."""
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


def _format_previous_findings(state: dict) -> str:
    """Format findings from previous iteration for context."""
    iterations = int(state.get("review_iterations", 0))
    if iterations == 0:
        return "First review — no prior findings."

    verdict = state.get("review_verdict", {}) or {}
    findings = verdict.get("findings", [])
    if not findings:
        return f"Previous iteration ({iterations}) had no specific findings."

    lines = [f"Previous iteration ({iterations}) found {len(findings)} issue(s):"]
    for f in findings:
        sev = f.get("severity", "unknown")
        desc = f.get("description", "")
        lines.append(f"  - [{sev}] {desc}")
    return "\n".join(lines)


def _parse_review_verdict(
    text: str, iteration: int, model_name: str,
) -> dict[str, Any]:
    """Extract JSON from LLM output and validate ReviewVerdict shape."""
    from app.models.schemas import ReviewVerdict

    stripped = text.strip()

    # Attempt 1: raw text is valid JSON
    try:
        data = json.loads(stripped)
        data["iteration"] = iteration
        data["reviewer_model"] = model_name
        ReviewVerdict.model_validate(data)
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
            data["iteration"] = iteration
            data["reviewer_model"] = model_name
            ReviewVerdict.model_validate(data)
            return data
        except (json.JSONDecodeError, Exception) as exc:
            logger.warning(
                "review_verdict_parse_failed", error=str(exc),
            )

    return _stub_review_verdict(iteration)


async def review_node(state: dict) -> dict:
    """Reviewer agent — validates patches for correctness, style, and security."""
    case_id = state.get("case_id", "unknown")
    publisher = None

    try:
        publisher = await get_publisher()

        iter_num = int(state.get("review_iterations", 0)) + 1

        if publisher:
            await publisher.publish_stage_change(
                case_id, "review", "started",
            )
            await publisher.publish_thinking(
                case_id,
                f"Reviewing code patches (iteration {iter_num})...",
            )

        from langchain_core.messages import HumanMessage, SystemMessage

        from app.config import settings
        from app.pipeline.cost import merge_cost
        from app.pipeline.prompts.reviewer import REVIEWER_SYSTEM_PROMPT
        from app.services.model_factory import create_chat_model

        config = _get_reviewer_model_config()
        llm = create_chat_model(config)

        execution_plan = state.get("execution_plan", {}) or {}
        dev_result = state.get("development_result", {}) or {}
        max_iterations = getattr(settings, "MAX_REVIEW_ITERATIONS", 3)

        prompt = REVIEWER_SYSTEM_PROMPT.format(
            execution_plan_json=json.dumps(execution_plan, indent=2),
            development_result_json=json.dumps(
                {k: v for k, v in dev_result.items() if k != "patches"},
                indent=2,
            ),
            patch_content=_format_patch_content(dev_result),
            iteration=iter_num,
            max_iterations=max_iterations,
            previous_findings=_format_previous_findings(state),
        )

        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content="Review the patches and provide your verdict."),
        ]
        response = await llm.ainvoke(messages)

        # Track tokens
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

        verdict = _parse_review_verdict(raw_content, iter_num, config.model_name)

        new_cost = merge_cost(
            state.get("cost", {}),
            config.model_name,
            input_tokens,
            output_tokens,
        )

        if publisher:
            await publisher.publish_stage_change(
                case_id, "review", "completed",
            )
            await publisher.publish_cost_update(case_id, new_cost)

        return {
            "current_stage": "review",
            "status": "pending_code_review",
            "review_verdict": verdict,
            "review_iterations": iter_num,
            "cost": new_cost,
            "events": [{
                "event_type": "stage_change",
                "data": {"stage": "review", "status": "completed"},
            }],
        }

    except Exception as exc:
        logger.error(
            "review_node_failed", case_id=case_id, error=str(exc),
            exc_info=True,
        )
        iter_num = int(state.get("review_iterations", 0)) + 1
        safe_msg = "Reviewer agent encountered an internal error."
        if publisher:
            try:
                await publisher.publish_error(
                    case_id, safe_msg, recoverable=True,
                )
            except Exception:
                pass

        return {
            "current_stage": "review",
            "status": "pending_code_review",
            "review_verdict": _stub_review_verdict(iter_num),
            "review_iterations": iter_num,
            "cost": state.get("cost", {}),
            "error": safe_msg,
            "events": [{
                "event_type": "error",
                "data": {"message": safe_msg},
            }],
        }
    finally:
        await close_publisher(publisher)
