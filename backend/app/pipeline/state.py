from typing import TypedDict, Optional, Annotated, List
from operator import add


class PipelineState(TypedDict):
    """TypedDict describing the LangGraph pipeline state for RV-Insights."""

    # Core identifiers
    case_id: str

    # Stages: explore | plan | develop | review | test
    current_stage: str

    # Status string that mirrors CaseStatus enum in backend/app/models/schemas.py
    status: str

    # Stage results (optional until produced by each node)
    exploration_result: Optional[dict]
    execution_plan: Optional[dict]
    development_result: Optional[dict]
    review_verdict: Optional[dict]
    test_result: Optional[dict]

    # Controller/state management
    review_iterations: int
    human_decision: Optional[str]   # approve | reject | abandon
    human_comment: Optional[str]

    # Cost accounting (tokens/cost) – kept generic for the skeleton
    cost: dict
    error: Optional[str]

    # Accumulated events for the pipeline lifecycle
    events: Annotated[List[dict], add]
