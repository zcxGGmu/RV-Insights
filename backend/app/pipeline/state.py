from __future__ import annotations

from operator import add
from typing import Annotated, TypedDict


class PipelineState(TypedDict):
    """TypedDict describing the LangGraph pipeline state for RV-Insights."""

    # Core identifiers
    case_id: str

    # Input context from the Case document
    input_context: str | None
    target_repo: str | None
    contribution_type: str | None

    # Stages: explore | plan | develop | review | test
    current_stage: str

    # Status string that mirrors CaseStatus enum in backend/app/models/schemas.py
    status: str

    # Stage results (optional until produced by each node)
    exploration_result: dict | None
    execution_plan: dict | None
    development_result: dict | None
    review_verdict: dict | None
    test_result: dict | None

    # Controller/state management
    review_iterations: int
    human_decision: str | None   # approve | reject | abandon
    human_comment: str | None

    # Cost accounting (tokens/cost) – kept generic for the skeleton
    cost: dict
    error: str | None

    # Accumulated events for the pipeline lifecycle
    events: Annotated[list[dict], add]
