"""Developer agent node — generates code patches (placeholder for Phase 2)."""

from __future__ import annotations

import asyncio

from ..stubs import _stub_development_result
from ._shared import publish_fire_and_forget


async def develop_node(state: dict) -> dict:
    case_id = state.get("case_id", "unknown")
    await publish_fire_and_forget(
        case_id, "agent_output",
        {"type": "thinking", "content": "Generating code changes..."},
    )
    await asyncio.sleep(0.5)
    await publish_fire_and_forget(
        case_id, "stage_change", {"stage": "develop", "status": "completed"},
    )
    return {
        "current_stage": "develop",
        "status": "reviewing",
        "development_result": _stub_development_result(),
        "events": [{
            "event_type": "stage_change",
            "data": {"stage": "develop", "status": "completed"},
        }],
    }
