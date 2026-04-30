"""Human gate and routing functions for pipeline flow control."""

from __future__ import annotations

from ..state import PipelineState

try:
    from langgraph.types import interrupt
except Exception:
    def interrupt(_prompt):  # type: ignore[misc]
        return {"action": "approve", "comment": "auto-approve (fallback)"}


def human_gate_node(state: PipelineState) -> dict:
    """Human gate that pauses pipeline for human decision."""
    decision = interrupt({
        "type": "review_request",
        "stage": state.get("current_stage"),
        "iteration": state.get("review_iterations", 0),
    })
    action = (
        decision.get("action", decision)
        if isinstance(decision, dict) else decision
    )
    comment = (
        decision.get("comment", "")
        if isinstance(decision, dict) else ""
    )
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
