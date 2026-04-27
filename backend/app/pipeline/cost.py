import structlog
from typing import Optional

from .state import PipelineState

logger = structlog.get_logger()


class CostLimitExceeded(Exception):
    def __init__(self, message: str, current_cost: float, limit: float):
        super().__init__(message)
        self.current_cost = current_cost
        self.limit = limit


class CostCircuitBreaker:
    def __init__(self, max_cost: Optional[float] = None):
        if max_cost is None:
            try:
                from app.config import settings
                max_cost = getattr(settings, "MAX_COST_PER_CASE", 10.0)
            except Exception:
                max_cost = 10.0
        self.max_cost = max_cost

    def check(self, state: PipelineState) -> None:
        # Safely extract cost information from the state
        cost = (state.get("cost", {}) or {})
        current = cost.get("estimated_cost_usd", 0.0)
        if current >= self.max_cost:
            logger.warning(
                "cost_limit_exceeded",
                case_id=state.get("case_id"),
                current_cost=current,
                limit=self.max_cost,
            )
            raise CostLimitExceeded(
                f"Cost {current:.2f} USD >= limit {self.max_cost:.2f} USD",
                current_cost=current,
                limit=self.max_cost,
            )
