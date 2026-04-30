from __future__ import annotations

import structlog

from .state import PipelineState

logger = structlog.get_logger()


class CostLimitExceededError(Exception):
    def __init__(self, message: str, current_cost: float, limit: float):
        super().__init__(message)
        self.current_cost = current_cost
        self.limit = limit


class CostCircuitBreaker:
    def __init__(self, max_cost: float | None = None):
        if max_cost is None:
            try:
                from app.config import settings
                max_cost = getattr(settings, "MAX_COST_PER_CASE", 10.0)
            except Exception:
                max_cost = 10.0
        self.max_cost = max_cost

    def check(self, state: PipelineState) -> None:
        cost = (state.get("cost", {}) or {})
        current = cost.get("estimated_cost_usd", 0.0)
        if current >= self.max_cost:
            logger.warning(
                "cost_limit_exceeded",
                case_id=state.get("case_id"),
                current_cost=current,
                limit=self.max_cost,
            )
            raise CostLimitExceededError(
                f"Cost {current:.2f} USD >= limit {self.max_cost:.2f} USD",
                current_cost=current,
                limit=self.max_cost,
            )


PRICING_PER_1M: dict[str, tuple[float, float]] = {
    # (input_per_1M_tokens, output_per_1M_tokens)
    "claude-sonnet-4-20250514": (3.0, 15.0),
    "claude-3-5-sonnet-20241022": (3.0, 15.0),
    "claude-3-5-haiku-20241022": (0.8, 4.0),
    "claude-3-opus-20240229": (15.0, 75.0),
    "gpt-4o": (2.5, 10.0),
    "gpt-4o-mini": (0.15, 0.6),
    "gpt-4-turbo": (10.0, 30.0),
    "deepseek-chat": (0.14, 0.28),
    "deepseek-coder": (0.14, 0.28),
    "deepseek-reasoner": (0.55, 2.19),
}

DEFAULT_PRICING = (3.0, 15.0)


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    inp_rate, out_rate = PRICING_PER_1M.get(model, DEFAULT_PRICING)
    return (input_tokens * inp_rate + output_tokens * out_rate) / 1_000_000


def merge_cost(
    old_cost: dict,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> dict:
    prev_in = old_cost.get("total_input_tokens", 0)
    prev_out = old_cost.get("total_output_tokens", 0)
    prev_usd = old_cost.get("estimated_cost_usd", 0.0)
    delta = estimate_cost(model, input_tokens, output_tokens)
    return {
        "total_input_tokens": prev_in + input_tokens,
        "total_output_tokens": prev_out + output_tokens,
        "estimated_cost_usd": round(prev_usd + delta, 6),
    }
