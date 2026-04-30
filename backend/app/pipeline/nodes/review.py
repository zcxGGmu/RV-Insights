"""Reviewer agent node — validates patches (placeholder for Phase 3)."""

from __future__ import annotations

import asyncio

from ..stubs import _stub_review_verdict
from ._shared import publish_fire_and_forget


async def review_node(state: dict) -> dict:
    case_id = state.get("case_id", "unknown")
    await publish_fire_and_forget(
        case_id, "agent_output",
        {"type": "thinking", "content": "Reviewing code for correctness and style..."},
    )
    await asyncio.sleep(0.5)
    iter_num = int(state.get("review_iterations", 0)) + 1
    await publish_fire_and_forget(
        case_id, "stage_change", {"stage": "review", "status": "completed"},
    )
    return {
        "current_stage": "review",
        "status": "pending_code_review",
        "review_verdict": _stub_review_verdict(iter_num),
        "review_iterations": iter_num,
        "events": [{
            "event_type": "stage_change",
            "data": {"stage": "review", "status": "completed"},
        }],
    }
