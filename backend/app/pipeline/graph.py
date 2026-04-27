from typing import Optional
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from .state import PipelineState
from .nodes import (
    explore_node,
    plan_node,
    develop_node,
    review_node,
    test_node,
    human_gate_node,
    route_human_decision,
    route_review_decision,
)
from .cost import CostCircuitBreaker


def _wrap_with_cost_check(node_fn, breaker: CostCircuitBreaker):
    async def wrapper(state: PipelineState) -> dict:
        breaker.check(state)
        return await node_fn(state)
    return wrapper


def build_pipeline_graph() -> StateGraph:
    graph = StateGraph(PipelineState)
    breaker = CostCircuitBreaker()

    graph.add_node("explore", _wrap_with_cost_check(explore_node, breaker))
    graph.add_node("explore_gate", human_gate_node)
    graph.add_node("plan", _wrap_with_cost_check(plan_node, breaker))
    graph.add_node("plan_gate", human_gate_node)
    graph.add_node("develop", _wrap_with_cost_check(develop_node, breaker))
    graph.add_node("review", _wrap_with_cost_check(review_node, breaker))
    graph.add_node("code_gate", human_gate_node)
    graph.add_node("test", _wrap_with_cost_check(test_node, breaker))
    graph.add_node("test_gate", human_gate_node)

    # Edges: START → explore → explore_gate → [route]
    graph.add_edge(START, "explore")
    graph.add_edge("explore", "explore_gate")
    graph.add_conditional_edges("explore_gate", route_human_decision, {
        "approve": "plan",
        "reject": "explore",
        "end": END,
    })

    # plan → plan_gate → [route]
    graph.add_edge("plan", "plan_gate")
    graph.add_conditional_edges("plan_gate", route_human_decision, {
        "approve": "develop",
        "reject": "plan",
        "end": END,
    })

    # develop → review → [route_review]
    graph.add_edge("develop", "review")
    graph.add_conditional_edges("review", route_review_decision, {
        "approve": "code_gate",
        "reject": "develop",
        "escalate": "code_gate",
    })

    # code_gate → [route]
    graph.add_conditional_edges("code_gate", route_human_decision, {
        "approve": "test",
        "reject": "develop",
        "end": END,
    })

    # test → test_gate → [route]
    graph.add_edge("test", "test_gate")
    graph.add_conditional_edges("test_gate", route_human_decision, {
        "approve": END,
        "reject": "develop",
        "end": END,
    })

    return graph


def get_pg_conn_string() -> str:
    from app.config import settings
    return settings.POSTGRES_URI


async def create_compiled_graph(pg_conn_string: Optional[str] = None):
    """Create compiled graph with Postgres checkpointer.

    Returns an async context manager that yields the compiled graph.
    Usage:
        async with create_compiled_graph() as compiled:
            result = await compiled.ainvoke(state, config=config)
    """
    if pg_conn_string is None:
        pg_conn_string = get_pg_conn_string()

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _compiled():
        async with AsyncPostgresSaver.from_conn_string(pg_conn_string) as checkpointer:
            await checkpointer.setup()
            graph = build_pipeline_graph()
            yield graph.compile(checkpointer=checkpointer)

    return _compiled()
