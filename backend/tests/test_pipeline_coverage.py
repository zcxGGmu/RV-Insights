"""Coverage boost tests — cost, stubs, schemas, graph, config, plan, explore."""

from __future__ import annotations

import json
import os
from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture(autouse=True)
def _setup_env():
    os.environ.setdefault("RV_INSIGHTS_TESTING", "1")
    os.environ.setdefault("DEFAULT_LLM_API_KEY", "test-key")


# ---------------------------------------------------------------------------
# Fake LLM helpers
# ---------------------------------------------------------------------------

class _FakeUsage:
    input_tokens = 100
    output_tokens = 50


class _FakeResponse:
    def __init__(self, content: str):
        self.content = content
        self.usage_metadata = _FakeUsage()


class _FakeLLM:
    def __init__(self, content: str):
        self._content = content

    async def ainvoke(self, messages):
        return _FakeResponse(self._content)


class _FailingLLM:
    async def ainvoke(self, messages):
        raise RuntimeError("LLM API unavailable")


# ═══════════════════════════════════════════════════════════════════════════
# A. Cost Module
# ═══════════════════════════════════════════════════════════════════════════

class TestCostModule:
    def test_estimate_cost_known_model(self):
        from app.pipeline.cost import estimate_cost

        cost = estimate_cost("gpt-4o", 1_000_000, 1_000_000)
        assert cost == 2.5 + 10.0

    def test_estimate_cost_unknown_model_uses_default(self):
        from app.pipeline.cost import estimate_cost

        cost = estimate_cost("unknown-model", 1_000_000, 1_000_000)
        assert cost == 3.0 + 15.0

    def test_merge_cost_accumulates(self):
        from app.pipeline.cost import merge_cost

        old = {"total_input_tokens": 100, "total_output_tokens": 50, "estimated_cost_usd": 0.001}
        result = merge_cost(old, "gpt-4o-mini", 200, 100)
        assert result["total_input_tokens"] == 300
        assert result["total_output_tokens"] == 150
        assert result["estimated_cost_usd"] > 0.001

    def test_merge_cost_empty_old(self):
        from app.pipeline.cost import merge_cost

        result = merge_cost({}, "gpt-4o", 100, 50)
        assert result["total_input_tokens"] == 100
        assert result["total_output_tokens"] == 50
        assert result["estimated_cost_usd"] > 0

    def test_circuit_breaker_raises_on_limit(self):
        from app.pipeline.cost import CostCircuitBreaker, CostLimitExceededError

        breaker = CostCircuitBreaker(max_cost=1.0)
        state = {"cost": {"estimated_cost_usd": 1.5}}
        with pytest.raises(CostLimitExceededError):
            breaker.check(state)

    def test_circuit_breaker_passes_under_limit(self):
        from app.pipeline.cost import CostCircuitBreaker

        breaker = CostCircuitBreaker(max_cost=10.0)
        state = {"cost": {"estimated_cost_usd": 0.5}}
        breaker.check(state)

    def test_circuit_breaker_empty_cost(self):
        from app.pipeline.cost import CostCircuitBreaker

        breaker = CostCircuitBreaker(max_cost=10.0)
        state = {"cost": {}}
        breaker.check(state)

    def test_circuit_breaker_none_cost(self):
        from app.pipeline.cost import CostCircuitBreaker

        breaker = CostCircuitBreaker(max_cost=10.0)
        state = {"cost": None}
        breaker.check(state)


# ═══════════════════════════════════════════════════════════════════════════
# B. Stub Factories
# ═══════════════════════════════════════════════════════════════════════════

class TestStubFactories:
    def test_stub_exploration_result_validates(self):
        from app.models.schemas import ExplorationResult
        from app.pipeline.stubs import _stub_exploration_result

        data = _stub_exploration_result()
        ExplorationResult.model_validate(data)

    def test_stub_execution_plan_validates(self):
        from app.models.schemas import ExecutionPlan
        from app.pipeline.stubs import _stub_execution_plan

        data = _stub_execution_plan()
        ExecutionPlan.model_validate(data)

    def test_stub_development_result_validates(self):
        from app.models.schemas import DevelopmentResult
        from app.pipeline.stubs import _stub_development_result

        data = _stub_development_result()
        DevelopmentResult.model_validate(data)

    def test_stub_review_verdict_validates(self):
        from app.models.schemas import ReviewVerdict
        from app.pipeline.stubs import _stub_review_verdict

        data = _stub_review_verdict(iteration=1)
        ReviewVerdict.model_validate(data)

    def test_stub_test_result_validates(self):
        from app.models.schemas import TestResult
        from app.pipeline.stubs import _stub_test_result

        data = _stub_test_result()
        TestResult.model_validate(data)


# ═══════════════════════════════════════════════════════════════════════════
# C. Schema Validation
# ═══════════════════════════════════════════════════════════════════════════

class TestSchemaValidation:
    def test_exploration_result(self):
        from app.models.schemas import ExplorationResult

        data = {
            "contribution_type": "bugfix",
            "title": "Test",
            "summary": "Test summary",
            "target_repo": "test/repo",
            "target_files": ["a.c"],
            "evidence": [],
            "feasibility_score": 0.9,
            "estimated_complexity": "low",
            "upstream_status": "open",
        }
        ExplorationResult.model_validate(data)

    def test_execution_plan(self):
        from app.models.schemas import ExecutionPlan

        data = {
            "dev_steps": [{
                "id": "s1", "description": "step", "target_files": ["a.c"],
                "expected_changes": "change", "risk_level": "low", "dependencies": [],
            }],
            "test_cases": [{
                "id": "t1", "name": "test", "type": "unit",
                "description": "desc", "expected_result": "pass", "qemu_required": False,
            }],
            "estimated_tokens": 1000,
            "risk_assessment": "low",
        }
        ExecutionPlan.model_validate(data)

    def test_development_result(self):
        from app.models.schemas import DevelopmentResult

        data = {
            "patch_files": ["a.c"],
            "changed_files": ["a.c"],
            "commit_message": "test: commit",
            "change_summary": "summary",
            "lines_added": 1,
            "lines_removed": 0,
        }
        DevelopmentResult.model_validate(data)

    def test_review_verdict(self):
        from app.models.schemas import ReviewVerdict

        data = {
            "approved": True,
            "findings": [],
            "iteration": 1,
            "reviewer_model": "gpt-4o",
            "summary": "Approved",
        }
        ReviewVerdict.model_validate(data)

    def test_test_result_full(self):
        from app.models.schemas import TestResult

        data = {
            "passed": True,
            "total_tests": 1,
            "passed_tests": 1,
            "failed_tests": 0,
            "test_case_results": [
                {"test_id": "t1", "name": "test", "passed": True, "message": "OK"},
            ],
            "compilation_passed": True,
            "test_log": "OK",
        }
        TestResult.model_validate(data)

    def test_test_result_minimal(self):
        from app.models.schemas import TestResult

        data = {
            "passed": False,
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
        }
        TestResult.model_validate(data)

    def test_test_case_result(self):
        from app.models.schemas import TestCaseResult

        data = {"test_id": "t1", "name": "Unit test", "passed": True, "message": "OK"}
        TestCaseResult.model_validate(data)

    def test_case_create(self):
        from app.models.schemas import CaseCreate

        data = {
            "title": "Test case",
            "target_repo": "test/repo",
            "input_context": "context",
        }
        CaseCreate.model_validate(data)


# ═══════════════════════════════════════════════════════════════════════════
# D. Graph Structure
# ═══════════════════════════════════════════════════════════════════════════

class TestGraphStructure:
    def test_graph_builds_without_error(self):
        langgraph = pytest.importorskip("langgraph")  # noqa: F841
        from app.pipeline.graph import build_pipeline_graph

        graph = build_pipeline_graph()
        assert graph is not None

    def test_graph_has_expected_nodes(self):
        pytest.importorskip("langgraph")
        from app.pipeline.graph import build_pipeline_graph

        graph = build_pipeline_graph()
        node_names = set(graph.nodes.keys())
        expected = {"explore", "explore_gate", "plan", "plan_gate",
                    "develop", "review", "code_gate", "test", "test_gate"}
        assert expected.issubset(node_names)

    def test_graph_has_nine_nodes(self):
        pytest.importorskip("langgraph")
        from app.pipeline.graph import build_pipeline_graph

        graph = build_pipeline_graph()
        # 9 pipeline nodes (excluding __start__ and __end__)
        pipeline_nodes = {k for k in graph.nodes.keys() if not k.startswith("__")}
        assert len(pipeline_nodes) == 9


# ═══════════════════════════════════════════════════════════════════════════
# E. Config
# ═══════════════════════════════════════════════════════════════════════════

class TestConfig:
    def test_settings_has_tester_model(self):
        from app.config import settings

        assert hasattr(settings, "TESTER_MODEL")
        assert hasattr(settings, "TESTER_PROVIDER")

    def test_settings_defaults(self):
        from app.config import settings

        assert settings.MAX_REVIEW_ITERATIONS == 3
        assert settings.MAX_COST_PER_CASE == 10.0

    def test_settings_has_all_agent_models(self):
        from app.config import settings

        for agent in ["EXPLORER", "PLANNER", "DEVELOPER", "REVIEWER", "TESTER"]:
            assert hasattr(settings, f"{agent}_MODEL")
            assert hasattr(settings, f"{agent}_PROVIDER")


# ═══════════════════════════════════════════════════════════════════════════
# F. Plan Node
# ═══════════════════════════════════════════════════════════════════════════

_VALID_PLAN = {
    "dev_steps": [{
        "id": "s1", "description": "Fix bug", "target_files": ["a.c"],
        "expected_changes": "Add null check", "risk_level": "low", "dependencies": [],
    }],
    "test_cases": [{
        "id": "t1", "name": "Unit test", "type": "unit",
        "description": "Verify fix", "expected_result": "pass", "qemu_required": False,
    }],
    "estimated_tokens": 5000,
    "risk_assessment": "low",
}

_PLAN_STATE = {
    "case_id": "test-001",
    "input_context": "Fix bug",
    "target_repo": "test/repo",
    "contribution_type": "bugfix",
    "current_stage": "explore",
    "status": "pending_explore_review",
    "exploration_result": {
        "contribution_type": "bugfix",
        "title": "Fix NPD",
        "summary": "Found a null pointer issue",
        "target_repo": "test/repo",
        "target_files": ["a.c"],
        "evidence": [],
        "feasibility_score": 0.9,
        "estimated_complexity": "low",
        "upstream_status": "open",
    },
    "review_iterations": 0,
    "cost": {},
    "events": [],
}


class TestPlanNode:
    @pytest.mark.asyncio
    async def test_success(self):
        from app.pipeline.nodes.plan import plan_node

        fake_llm = _FakeLLM(json.dumps(_VALID_PLAN))

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=fake_llm,
        ):
            result = await plan_node(_PLAN_STATE)

        assert result["current_stage"] == "plan"
        assert result["status"] == "pending_plan_review"
        assert len(result["execution_plan"]["dev_steps"]) == 1
        assert "error" not in result

    @pytest.mark.asyncio
    async def test_llm_failure(self):
        from app.pipeline.nodes.plan import plan_node

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=_FailingLLM(),
        ):
            result = await plan_node(_PLAN_STATE)

        assert result["current_stage"] == "plan"
        assert "error" in result
        assert result["execution_plan"]["dev_steps"][0]["id"] == "s1"

    @pytest.mark.asyncio
    async def test_garbage_returns_stub(self):
        from app.pipeline.nodes.plan import plan_node

        fake_llm = _FakeLLM("Not valid JSON at all!")

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=fake_llm,
        ):
            result = await plan_node(_PLAN_STATE)

        assert result["current_stage"] == "plan"
        assert result["execution_plan"]["dev_steps"][0]["description"] == "Stub step"


class TestPlanValidation:
    def test_validate_plan_removes_invalid_deps(self):
        from app.pipeline.nodes.plan import _validate_plan

        plan = {
            "dev_steps": [
                {"id": "s1", "dependencies": ["s2", "nonexistent"]},
                {"id": "s2", "dependencies": []},
            ],
            "estimated_tokens": 5000,
        }
        result = _validate_plan(plan)
        assert result["dev_steps"][0]["dependencies"] == ["s2"]

    def test_validate_plan_clamps_tokens(self):
        from app.pipeline.nodes.plan import _validate_plan

        plan = {"dev_steps": [], "estimated_tokens": -1}
        result = _validate_plan(plan)
        assert result["estimated_tokens"] == 50_000

    def test_validate_plan_removes_self_deps(self):
        from app.pipeline.nodes.plan import _validate_plan

        plan = {
            "dev_steps": [{"id": "s1", "dependencies": ["s1"]}],
            "estimated_tokens": 5000,
        }
        result = _validate_plan(plan)
        assert result["dev_steps"][0]["dependencies"] == []


class TestParseExecutionPlan:
    def test_clean_json(self):
        from app.pipeline.nodes.plan import _parse_execution_plan

        result = _parse_execution_plan(json.dumps(_VALID_PLAN))
        assert len(result["dev_steps"]) == 1

    def test_fenced_json(self):
        from app.pipeline.nodes.plan import _parse_execution_plan

        text = f"```json\n{json.dumps(_VALID_PLAN)}\n```"
        result = _parse_execution_plan(text)
        assert len(result["dev_steps"]) == 1

    def test_garbage_returns_stub(self):
        from app.pipeline.nodes.plan import _parse_execution_plan

        result = _parse_execution_plan("This is not JSON!")
        assert result["dev_steps"][0]["id"] == "s1"
        assert result["dev_steps"][0]["description"] == "Stub step"
