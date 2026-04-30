"""Stub node for test_node (will be replaced in Sprint 7)."""

from __future__ import annotations

import asyncio

from ..stubs import _stub_test_result
from ._shared import publish_fire_and_forget


async def test_node(state: dict) -> dict:
    case_id = state.get("case_id", "unknown")
    await publish_fire_and_forget(
        case_id, "agent_output",
        {"type": "thinking", "content": "Running tests and compilation checks..."},
    )
    await asyncio.sleep(0.5)
    await publish_fire_and_forget(
        case_id, "stage_change", {"stage": "test", "status": "completed"},
    )
    return {
        "current_stage": "test",
        "status": "pending_test_review",
        "test_result": _stub_test_result(),
        "events": [{
            "event_type": "stage_change",
            "data": {"stage": "test", "status": "completed"},
        }],
    }
