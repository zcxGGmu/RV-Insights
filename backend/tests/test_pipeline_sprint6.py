"""Sprint 6 pipeline tests — develop_node, review_node, routing, stubs, parsing."""

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


# ---------------------------------------------------------------------------
# Valid fixture data
# ---------------------------------------------------------------------------

_VALID_DEV_RESULT = {
    "patch_files": ["drivers/riscv/fix.c"],
    "patches": {
        "drivers/riscv/fix.c": {
            "filename": "drivers/riscv/fix.c",
            "original_content": "int old(void) {}",
            "modified_content": "int new_func(void) {}",
            "diff_content": "--- a/fix.c\n+++ b/fix.c",
            "language": "c",
        },
    },
    "changed_files": ["drivers/riscv/fix.c"],
    "commit_message": "riscv: fix null pointer dereference",
    "change_summary": "Fixed NPD in riscv driver init path",
    "lines_added": 5,
    "lines_removed": 2,
}

_VALID_REVIEW_APPROVED = {
    "approved": True,
    "findings": [],
    "summary": "Patch looks correct and follows kernel style.",
}

_VALID_REVIEW_REJECTED = {
    "approved": False,
    "findings": [
        {
            "severity": "major",
            "category": "correctness",
            "file": "drivers/riscv/fix.c",
            "line": 42,
            "description": "Missing NULL check before dereference",
            "suggestion": "Add if (!ptr) return -EINVAL;",
        },
        {
            "severity": "minor",
            "category": "style",
            "description": "Line exceeds 80 columns",
        },
    ],
    "summary": "Patch has a correctness issue that must be fixed.",
}

_BASE_STATE = {
    "case_id": "test-case-001",
    "input_context": "Fix null pointer in riscv driver",
    "target_repo": "torvalds/linux",
    "contribution_type": "bugfix",
    "current_stage": "plan",
    "status": "planned",
    "execution_plan": {
        "dev_steps": [{
            "id": "s1",
            "description": "Fix the bug",
            "target_files": ["drivers/riscv/fix.c"],
            "expected_changes": "Add null check",
            "risk_level": "low",
            "dependencies": [],
        }],
        "test_cases": [],
        "estimated_tokens": 0,
        "risk_assessment": "low",
    },
    "review_iterations": 0,
    "cost": {},
    "events": [],
}


# ═══════════════════════════════════════════════════════════════════════════
# A. JSON Parsing Tests
# ═══════════════════════════════════════════════════════════════════════════

class TestParseDevelopmentResult:
    def test_clean_json(self):
        from app.pipeline.nodes.develop import _parse_development_result

        text = json.dumps(_VALID_DEV_RESULT)
        result = _parse_development_result(text)
        assert result["commit_message"] == "riscv: fix null pointer dereference"
        assert "drivers/riscv/fix.c" in result["patches"]

    def test_fenced_json(self):
        from app.pipeline.nodes.develop import _parse_development_result

        text = f"```json\n{json.dumps(_VALID_DEV_RESULT)}\n```"
        result = _parse_development_result(text)
        assert result["commit_message"] == "riscv: fix null pointer dereference"

    def test_garbage_returns_stub(self):
        from app.pipeline.nodes.develop import _parse_development_result

        result = _parse_development_result("This is not JSON at all!")
        assert result["commit_message"] == "stub: placeholder commit"
        assert result["patches"] == {}


class TestParseReviewVerdict:
    def test_clean_json(self):
        from app.pipeline.nodes.review import _parse_review_verdict

        text = json.dumps(_VALID_REVIEW_APPROVED)
        result = _parse_review_verdict(text, iteration=1, model_name="gpt-4o")
        assert result["approved"] is True
        assert result["iteration"] == 1
        assert result["reviewer_model"] == "gpt-4o"

    def test_fenced_json(self):
        from app.pipeline.nodes.review import _parse_review_verdict

        text = f"```json\n{json.dumps(_VALID_REVIEW_REJECTED)}\n```"
        result = _parse_review_verdict(text, iteration=2, model_name="gpt-4o")
        assert result["approved"] is False
        assert len(result["findings"]) == 2
        assert result["iteration"] == 2

    def test_garbage_returns_stub_that_rejects(self):
        from app.pipeline.nodes.review import _parse_review_verdict

        result = _parse_review_verdict(
            "I cannot produce JSON", iteration=1, model_name="test",
        )
        assert result["approved"] is False


# ═══════════════════════════════════════════════════════════════════════════
# B. Routing Logic Tests
# ═══════════════════════════════════════════════════════════════════════════

class TestRouteReviewDecision:
    def test_approved(self):
        from app.pipeline.nodes.gates import route_review_decision

        state = {"review_verdict": {"approved": True}, "review_iterations": 1}
        assert route_review_decision(state) == "approve"

    def test_rejected(self):
        from app.pipeline.nodes.gates import route_review_decision

        state = {"review_verdict": {"approved": False}, "review_iterations": 1}
        assert route_review_decision(state) == "reject"

    def test_escalated_at_max_iterations(self):
        from app.pipeline.nodes.gates import route_review_decision

        state = {"review_verdict": {"approved": False}, "review_iterations": 3}
        assert route_review_decision(state) == "escalate"


class TestRouteHumanDecision:
    def test_approve(self):
        from app.pipeline.nodes.gates import route_human_decision

        assert route_human_decision({"human_decision": "approve"}) == "approve"

    def test_reject(self):
        from app.pipeline.nodes.gates import route_human_decision

        assert route_human_decision({"human_decision": "reject"}) == "reject"

    def test_abandon(self):
        from app.pipeline.nodes.gates import route_human_decision

        assert route_human_decision({"human_decision": "abandon"}) == "end"

    def test_default_is_approve(self):
        from app.pipeline.nodes.gates import route_human_decision

        assert route_human_decision({}) == "approve"


class TestHumanGateResetsIterations:
    def test_reject_from_review_resets(self):
        from app.pipeline.nodes.gates import human_gate_node

        state = {
            "current_stage": "review",
            "review_iterations": 3,
        }
        with patch(
            "app.pipeline.nodes.gates.interrupt",
            return_value={"action": "reject", "comment": "needs rework"},
        ):
            result = human_gate_node(state)
        assert result["human_decision"] == "reject"
        assert result["review_iterations"] == 0

    def test_approve_does_not_reset(self):
        from app.pipeline.nodes.gates import human_gate_node

        state = {
            "current_stage": "review",
            "review_iterations": 2,
        }
        with patch(
            "app.pipeline.nodes.gates.interrupt",
            return_value={"action": "approve", "comment": ""},
        ):
            result = human_gate_node(state)
        assert result["human_decision"] == "approve"
        assert "review_iterations" not in result


# ═══════════════════════════════════════════════════════════════════════════
# C. Node Execution Tests
# ═══════════════════════════════════════════════════════════════════════════

class TestDevelopNode:
    @pytest.mark.asyncio
    async def test_success(self):
        from app.pipeline.nodes.develop import develop_node

        fake_llm = _FakeLLM(json.dumps(_VALID_DEV_RESULT))

        with (
            patch(
                "app.services.model_factory.create_chat_model",
                return_value=fake_llm,
            ),
            patch(
                "app.pipeline.tools.source_fetcher.fetch_source_files",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "app.pipeline.nodes._shared.get_publisher",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            result = await develop_node(_BASE_STATE)

        assert result["current_stage"] == "develop"
        assert result["status"] == "reviewing"
        assert result["development_result"]["commit_message"] == (
            "riscv: fix null pointer dereference"
        )
        assert "error" not in result

    @pytest.mark.asyncio
    async def test_llm_failure_returns_stub_with_safe_error(self):
        from app.pipeline.nodes.develop import develop_node

        with (
            patch(
                "app.services.model_factory.create_chat_model",
                return_value=_FailingLLM(),
            ),
            patch(
                "app.pipeline.tools.source_fetcher.fetch_source_files",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "app.pipeline.nodes._shared.get_publisher",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            result = await develop_node(_BASE_STATE)

        assert result["current_stage"] == "develop"
        assert result["development_result"]["commit_message"] == (
            "stub: placeholder commit"
        )
        assert "LLM API unavailable" not in result.get("error", "")
        assert "internal error" in result["error"].lower()


class TestReviewNode:
    @pytest.mark.asyncio
    async def test_success_approved(self):
        from app.pipeline.nodes.review import review_node

        fake_llm = _FakeLLM(json.dumps(_VALID_REVIEW_APPROVED))
        state = {
            **_BASE_STATE,
            "current_stage": "develop",
            "status": "reviewing",
            "development_result": _VALID_DEV_RESULT,
        }

        with (
            patch(
                "app.services.model_factory.create_chat_model",
                return_value=fake_llm,
            ),
            patch(
                "app.pipeline.nodes._shared.get_publisher",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            result = await review_node(state)

        assert result["current_stage"] == "review"
        assert result["review_verdict"]["approved"] is True
        assert result["review_iterations"] == 1

    @pytest.mark.asyncio
    async def test_success_rejected_with_findings(self):
        from app.pipeline.nodes.review import review_node

        fake_llm = _FakeLLM(json.dumps(_VALID_REVIEW_REJECTED))
        state = {
            **_BASE_STATE,
            "current_stage": "develop",
            "status": "reviewing",
            "development_result": _VALID_DEV_RESULT,
        }

        with (
            patch(
                "app.services.model_factory.create_chat_model",
                return_value=fake_llm,
            ),
            patch(
                "app.pipeline.nodes._shared.get_publisher",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            result = await review_node(state)

        assert result["review_verdict"]["approved"] is False
        assert len(result["review_verdict"]["findings"]) == 2
        assert result["review_verdict"]["findings"][0]["severity"] == "major"


# ═══════════════════════════════════════════════════════════════════════════
# D. Stub Safety Tests
# ═══════════════════════════════════════════════════════════════════════════

class TestStubSafety:
    def test_stub_review_verdict_rejects(self):
        from app.pipeline.stubs import _stub_review_verdict

        verdict = _stub_review_verdict(iteration=1)
        assert verdict["approved"] is False

    def test_stub_review_verdict_has_critical_finding(self):
        from app.pipeline.stubs import _stub_review_verdict

        verdict = _stub_review_verdict(iteration=1)
        assert len(verdict["findings"]) > 0
        assert verdict["findings"][0]["severity"] == "critical"

    def test_stub_review_verdict_indicates_failure(self):
        from app.pipeline.stubs import _stub_review_verdict

        verdict = _stub_review_verdict(iteration=2)
        assert "stub-fallback" in verdict["reviewer_model"]
        assert "NOT approved" in verdict["summary"] or "not" in verdict["summary"].lower()


# ═══════════════════════════════════════════════════════════════════════════
# E. Interrupt Fallback Safety
# ═══════════════════════════════════════════════════════════════════════════

class TestInterruptFallback:
    def test_fallback_raises_runtime_error(self):
        import importlib
        import sys

        saved = sys.modules.get("langgraph.types")
        sys.modules["langgraph.types"] = None  # type: ignore[assignment]
        try:
            if "app.pipeline.nodes.gates" in sys.modules:
                del sys.modules["app.pipeline.nodes.gates"]
            if "app.pipeline.nodes" in sys.modules:
                del sys.modules["app.pipeline.nodes"]

            gates = importlib.import_module("app.pipeline.nodes.gates")
            with pytest.raises(RuntimeError, match="cannot bypass human gate"):
                gates.interrupt({"type": "test"})
        finally:
            if saved is not None:
                sys.modules["langgraph.types"] = saved
            elif "langgraph.types" in sys.modules:
                del sys.modules["langgraph.types"]
            if "app.pipeline.nodes.gates" in sys.modules:
                del sys.modules["app.pipeline.nodes.gates"]
            if "app.pipeline.nodes" in sys.modules:
                del sys.modules["app.pipeline.nodes"]
