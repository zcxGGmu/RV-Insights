"""Developer agent node — generates code patches from execution plan."""

from __future__ import annotations

import json
import re
from typing import Any

from ..stubs import _stub_development_result
from ._shared import close_publisher, get_publisher, logger


def _get_developer_model_config():
    """Build a ModelConfig for the Developer agent from settings."""
    from app.config import settings
    from app.services.model_factory import ModelConfig

    provider = getattr(
        settings, "DEVELOPER_PROVIDER", settings.DEFAULT_LLM_PROVIDER,
    )
    model = getattr(
        settings, "DEVELOPER_MODEL", settings.DEFAULT_LLM_MODEL,
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
        temperature=0.3,
        context_window=settings.DEFAULT_LLM_CONTEXT_WINDOW,
    )


def _collect_target_files(execution_plan: dict) -> list[str]:
    """Extract deduplicated target file paths from execution plan steps."""
    seen: set[str] = set()
    files: list[str] = []
    for step in execution_plan.get("dev_steps", []):
        for f in step.get("target_files", []):
            if f not in seen:
                seen.add(f)
                files.append(f)
    return files


def _format_source_context(sources: dict[str, str]) -> str:
    """Format fetched source files into a prompt-friendly string."""
    if not sources:
        return "(No source files available — generate patches based on plan context only.)"

    parts: list[str] = []
    for path, content in sources.items():
        if content:
            truncated = content[:8000] if len(content) > 8000 else content
            parts.append(f"### {path}\n```\n{truncated}\n```")
        else:
            parts.append(f"### {path}\n(File not found in repository — treat as new file.)")
    return "\n\n".join(parts)


def _format_review_feedback(state: dict) -> str:
    """Format review verdict as feedback for the developer on rework iterations."""
    iterations = int(state.get("review_iterations", 0))
    if iterations == 0:
        return "(First iteration — no prior review feedback.)"

    verdict = state.get("review_verdict", {}) or {}
    if not verdict:
        return "(Previous review data unavailable.)"

    parts = [f"Iteration {iterations} — the reviewer REJECTED your previous patch."]
    parts.append(f"Summary: {verdict.get('summary', 'N/A')}")

    findings = verdict.get("findings", [])
    if findings:
        parts.append("\nFindings to fix:")
        for i, f in enumerate(findings, 1):
            severity = f.get("severity", "unknown").upper()
            desc = f.get("description", "")
            suggestion = f.get("suggestion", "")
            file_ref = f.get("file", "")
            line_ref = f.get("line")
            location = f"{file_ref}:{line_ref}" if line_ref else file_ref
            entry = f"  {i}. [{severity}] {desc}"
            if location:
                entry += f" (at {location})"
            if suggestion:
                entry += f"\n     Suggestion: {suggestion}"
            parts.append(entry)

    return "\n".join(parts)


def _parse_development_result(text: str) -> dict[str, Any]:
    """Extract JSON from LLM output and validate DevelopmentResult shape."""
    from app.models.schemas import DevelopmentResult

    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()

    try:
        data = json.loads(cleaned)
        DevelopmentResult.model_validate(data)
        return data
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("development_result_parse_failed", error=str(exc))

    # Try extracting from fenced block
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            DevelopmentResult.model_validate(data)
            return data
        except (json.JSONDecodeError, Exception):
            pass

    return _stub_development_result()


async def develop_node(state: dict) -> dict:
    """Developer agent — generates code patches following the execution plan."""
    case_id = state.get("case_id", "unknown")
    publisher = None

    try:
        publisher = await get_publisher()

        if publisher:
            await publisher.publish_stage_change(
                case_id, "develop", "started",
            )
            iteration = int(state.get("review_iterations", 0))
            thinking_msg = (
                "Generating code patches based on execution plan..."
                if iteration == 0
                else f"Reworking patches based on review feedback (iteration {iteration + 1})..."
            )
            await publisher.publish_thinking(case_id, thinking_msg)

        from langchain_core.messages import HumanMessage, SystemMessage

        from app.pipeline.cost import merge_cost
        from app.pipeline.prompts.developer import DEVELOPER_SYSTEM_PROMPT
        from app.pipeline.tools.source_fetcher import fetch_source_files
        from app.services.model_factory import create_chat_model

        config = _get_developer_model_config()
        llm = create_chat_model(config)

        # Extract target files from execution plan
        execution_plan = state.get("execution_plan", {}) or {}
        target_files = _collect_target_files(execution_plan)

        # Fetch source file contents for context
        target_repo = state.get("target_repo", "")
        source_files = await fetch_source_files(target_repo, target_files) if target_files else {}

        # Build prompt
        prompt = DEVELOPER_SYSTEM_PROMPT.format(
            execution_plan_json=json.dumps(execution_plan, indent=2),
            source_files_context=_format_source_context(source_files),
            review_feedback=_format_review_feedback(state),
        )

        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content="Generate the patches now."),
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

        result = _parse_development_result(raw_content)

        # Ensure patch_files is consistent with patches keys
        if result.get("patches") and not result.get("patch_files"):
            result = {**result, "patch_files": list(result["patches"].keys())}

        new_cost = merge_cost(
            state.get("cost", {}),
            config.model_name,
            input_tokens,
            output_tokens,
        )

        if publisher:
            await publisher.publish_stage_change(
                case_id, "develop", "completed",
            )
            await publisher.publish_cost_update(case_id, new_cost)

        return {
            "current_stage": "develop",
            "status": "reviewing",
            "development_result": result,
            "cost": new_cost,
            "events": [{
                "event_type": "stage_change",
                "data": {"stage": "develop", "status": "completed"},
            }],
        }

    except Exception as exc:
        logger.error(
            "develop_node_failed", case_id=case_id, error=str(exc),
        )
        if publisher:
            try:
                await publisher.publish_error(
                    case_id, f"Developer failed: {exc!s}", recoverable=True,
                )
            except Exception:
                pass

        return {
            "current_stage": "develop",
            "status": "reviewing",
            "development_result": _stub_development_result(),
            "cost": state.get("cost", {}),
            "error": str(exc),
            "events": [{
                "event_type": "error",
                "data": {"message": str(exc)},
            }],
        }
    finally:
        await close_publisher(publisher)
