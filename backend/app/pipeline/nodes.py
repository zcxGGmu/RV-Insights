import asyncio
from typing import Optional, Dict

from .state import PipelineState
try:
    from langgraph.types import interrupt
except Exception:
    # Fallback if interrupt is unavailable in this runtime
    def interrupt(_prompt):
        # Default to automatic approval in fallback scenarios
        return {"action": "approve", "comment": "auto-approve (fallback)"}


def _stub_exploration_result() -> dict:
    return {
        "contribution_type": "bugfix",
        "title": "Stub exploration",
        "summary": "Placeholder exploration result from stub node",
        "target_repo": "stub/repo",
        "target_files": ["stub.py"],
        "evidence": [],
        "feasibility_score": 0.8,
        "estimated_complexity": "low",
        "upstream_status": "open",
    }


def _stub_execution_plan() -> dict:
    return {
        "dev_steps": [{"id": "s1", "description": "Stub step", "target_files": ["stub.py"],
                       "expected_changes": "none", "risk_level": "low", "dependencies": []}],
        "test_cases": [{"id": "t1", "name": "Stub test", "type": "unit", "description": "Stub",
                        "expected_result": "pass", "qemu_required": False}],
        "estimated_tokens": 0,
        "risk_assessment": "low",
    }


def _stub_development_result() -> dict:
    return {
        "patch_files": [],
        "changed_files": ["stub.py"],
        "commit_message": "stub: placeholder commit",
        "change_summary": "Stub development result",
        "lines_added": 0,
        "lines_removed": 0,
    }


def _stub_review_verdict(iteration: int) -> dict:
    return {
        "approved": True,
        "findings": [],
        "iteration": iteration,
        "reviewer_model": "stub",
        "summary": "Stub review: auto-approved",
    }


def _stub_test_result() -> dict:
    return {
        "passed": True,
        "total_tests": 1,
        "passed_tests": 1,
        "failed_tests": 0,
        "test_log_path": "/tmp/stub_test.log",
        "failure_details": [],
    }


async def explore_node(state: PipelineState) -> dict:
    await asyncio.sleep(0.5)
    return {
        "current_stage": "explore",
        "status": "pending_explore_review",
        "exploration_result": _stub_exploration_result(),
        "events": [{"event_type": "stage_change", "data": {"stage": "explore", "status": "completed"}}],
    }


async def plan_node(state: PipelineState) -> dict:
    await asyncio.sleep(0.5)
    return {
        "current_stage": "plan",
        "status": "pending_plan_review",
        "execution_plan": _stub_execution_plan(),
        "events": [{"event_type": "stage_change", "data": {"stage": "plan", "status": "completed"}}],
    }


async def develop_node(state: PipelineState) -> dict:
    await asyncio.sleep(0.5)
    return {
        "current_stage": "develop",
        "status": "reviewing",
        "development_result": _stub_development_result(),
        "events": [{"event_type": "stage_change", "data": {"stage": "develop", "status": "completed"}}],
    }


async def review_node(state: PipelineState) -> dict:
    await asyncio.sleep(0.5)
    iter_num = int(state.get("review_iterations", 0)) + 1
    return {
        "current_stage": "review",
        "status": "pending_code_review",
        "review_verdict": _stub_review_verdict(iter_num),
        "review_iterations": iter_num,
        "events": [{"event_type": "stage_change", "data": {"stage": "review", "status": "completed"}}],
    }


async def test_node(state: PipelineState) -> dict:
    await asyncio.sleep(0.5)
    return {
        "current_stage": "test",
        "status": "pending_test_review",
        "test_result": _stub_test_result(),
        "events": [{"event_type": "stage_change", "data": {"stage": "test", "status": "completed"}}],
    }


def human_gate_node(state: PipelineState) -> dict:
    """Human gate that pauses pipeline for human decision."""
    decision = interrupt({
        "type": "review_request",
        "stage": state.get("current_stage"),
        "iteration": state.get("review_iterations", 0),
    })
    # Normalize shape to expected fields
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
    # Lazy import to avoid module-level dependency in tests without config
    try:
        from app.config import settings  # type: ignore
        max_iter = getattr(settings, "MAX_REVIEW_ITERATIONS", 3)
    except Exception:
        max_iter = 3
    if state.get("review_iterations", 0) >= max_iter:
        return "escalate"
    return "reject"
