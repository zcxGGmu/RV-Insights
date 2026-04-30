"""Sprint 7 pipeline tests — test_node, parsing, stub safety, plan/explore nodes."""

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
# Fake LLM helpers (reused from sprint6 pattern)
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

_VALID_TEST_RESULT = {
    "passed": True,
    "total_tests": 2,
    "passed_tests": 2,
    "failed_tests": 0,
    "compilation_passed": True,
    "test_case_results": [
        {"test_id": "t1", "name": "Unit test", "passed": True, "message": "OK"},
        {"test_id": "t2", "name": "Boot test", "passed": True, "message": "OK"},
    ],
    "failure_details": [],
    "test_log": "gcc: OK\nAll tests passed.",
}

_VALID_TEST_RESULT_FAILED = {
    "passed": False,
    "total_tests": 2,
    "passed_tests": 1,
    "failed_tests": 1,
    "compilation_passed": True,
    "test_case_results": [
        {"test_id": "t1", "name": "Unit test", "passed": True, "message": "OK"},
        {"test_id": "t2", "name": "Boot test", "passed": False, "message": "Kernel panic"},
    ],
    "failure_details": ["t2: Boot test failed — Kernel panic on RISC-V QEMU"],
    "test_log": "gcc: OK\nt1: PASS\nt2: FAIL — kernel panic",
}

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

_BASE_STATE = {
    "case_id": "test-case-001",
    "input_context": "Fix null pointer in riscv driver",
    "target_repo": "torvalds/linux",
    "contribution_type": "bugfix",
    "current_stage": "review",
    "status": "pending_code_review",
    "execution_plan": {
        "dev_steps": [{
            "id": "s1",
            "description": "Fix the bug",
            "target_files": ["drivers/riscv/fix.c"],
            "expected_changes": "Add null check",
            "risk_level": "low",
            "dependencies": [],
        }],
        "test_cases": [
            {
                "id": "t1", "name": "Unit test", "type": "unit",
                "description": "Verify null check", "expected_result": "pass",
                "qemu_required": False,
            },
            {
                "id": "t2", "name": "Boot test", "type": "boot",
                "description": "QEMU boot", "expected_result": "pass",
                "qemu_required": True,
            },
        ],
        "estimated_tokens": 0,
        "risk_assessment": "low",
    },
    "development_result": _VALID_DEV_RESULT,
    "review_iterations": 0,
    "cost": {},
    "events": [],
}


# ═══════════════════════════════════════════════════════════════════════════
# A. Test Result Parsing
# ═══════════════════════════════════════════════════════════════════════════

class TestParseTestResult:
    def test_clean_json(self):
        from app.pipeline.nodes.test import _parse_test_result

        text = json.dumps(_VALID_TEST_RESULT)
        result = _parse_test_result(text)
        assert result["passed"] is True
        assert result["total_tests"] == 2
        assert result["compilation_passed"] is True
        assert len(result["test_case_results"]) == 2

    def test_fenced_json(self):
        from app.pipeline.nodes.test import _parse_test_result

        text = f"```json\n{json.dumps(_VALID_TEST_RESULT_FAILED)}\n```"
        result = _parse_test_result(text)
        assert result["passed"] is False
        assert result["failed_tests"] == 1
        assert len(result["failure_details"]) == 1

    def test_garbage_returns_stub_that_fails(self):
        from app.pipeline.nodes.test import _parse_test_result

        result = _parse_test_result("This is not JSON at all!")
        assert result["passed"] is False
        assert result["compilation_passed"] is False

    def test_partial_json_missing_fields(self):
        from app.pipeline.nodes.test import _parse_test_result

        partial = json.dumps({"passed": True})
        result = _parse_test_result(partial)
        # Missing required fields → falls through to stub
        assert result["passed"] is False


# ═══════════════════════════════════════════════════════════════════════════
# B. Test Node Execution
# ═══════════════════════════════════════════════════════════════════════════

class TestTestNode:
    @pytest.mark.asyncio
    async def test_success_passed(self):
        from app.pipeline.nodes.test import test_node

        fake_llm = _FakeLLM(json.dumps(_VALID_TEST_RESULT))

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=fake_llm,
        ):
            result = await test_node(_BASE_STATE)

        assert result["current_stage"] == "test"
        assert result["status"] == "pending_test_review"
        assert result["test_result"]["passed"] is True
        assert result["test_result"]["total_tests"] == 2
        assert "error" not in result

    @pytest.mark.asyncio
    async def test_success_failed(self):
        from app.pipeline.nodes.test import test_node

        fake_llm = _FakeLLM(json.dumps(_VALID_TEST_RESULT_FAILED))

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=fake_llm,
        ):
            result = await test_node(_BASE_STATE)

        assert result["test_result"]["passed"] is False
        assert result["test_result"]["failed_tests"] == 1

    @pytest.mark.asyncio
    async def test_llm_failure_returns_stub_with_safe_error(self):
        from app.pipeline.nodes.test import test_node

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=_FailingLLM(),
        ):
            result = await test_node(_BASE_STATE)

        assert result["current_stage"] == "test"
        assert result["test_result"]["passed"] is False
        assert "LLM API unavailable" not in result.get("error", "")
        assert "internal error" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_cost_tracking(self):
        from app.pipeline.nodes.test import test_node

        fake_llm = _FakeLLM(json.dumps(_VALID_TEST_RESULT))
        state = {**_BASE_STATE, "cost": {"total_input_tokens": 500, "total_output_tokens": 200, "estimated_cost_usd": 0.005}}

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=fake_llm,
        ):
            result = await test_node(state)

        assert result["cost"]["total_input_tokens"] == 600
        assert result["cost"]["total_output_tokens"] == 250
        assert result["cost"]["estimated_cost_usd"] > 0.005

    @pytest.mark.asyncio
    async def test_status_set_to_pending_test_review(self):
        from app.pipeline.nodes.test import test_node

        fake_llm = _FakeLLM(json.dumps(_VALID_TEST_RESULT))

        with patch(
            "app.services.model_factory.create_chat_model",
            return_value=fake_llm,
        ):
            result = await test_node(_BASE_STATE)

        assert result["status"] == "pending_test_review"
        assert result["events"][0]["data"]["stage"] == "test"


# ═══════════════════════════════════════════════════════════════════════════
# C. Stub Safety (test_result)
# ═══════════════════════════════════════════════════════════════════════════

class TestStubTestResultSafety:
    def test_stub_test_result_fails_closed(self):
        from app.pipeline.stubs import _stub_test_result

        result = _stub_test_result()
        assert result["passed"] is False

    def test_stub_test_result_compilation_fails(self):
        from app.pipeline.stubs import _stub_test_result

        result = _stub_test_result()
        assert result["compilation_passed"] is False

    def test_stub_test_result_has_failure_details(self):
        from app.pipeline.stubs import _stub_test_result

        result = _stub_test_result()
        assert len(result["failure_details"]) > 0

    def test_stub_test_result_has_zero_tests(self):
        from app.pipeline.stubs import _stub_test_result

        result = _stub_test_result()
        assert result["total_tests"] == 0
        assert result["passed_tests"] == 0


# ═══════════════════════════════════════════════════════════════════════════
# D. Patch Content Formatting
# ═══════════════════════════════════════════════════════════════════════════

class TestFormatPatchContent:
    def test_formats_diff_content(self):
        from app.pipeline.nodes.test import _format_patch_content

        result = _format_patch_content(_VALID_DEV_RESULT)
        assert "drivers/riscv/fix.c" in result
        assert "--- a/fix.c" in result

    def test_empty_patches(self):
        from app.pipeline.nodes.test import _format_patch_content

        result = _format_patch_content({"patches": {}, "changed_files": ["a.c"]})
        assert "No detailed patches" in result

    def test_fallback_to_modified_content(self):
        from app.pipeline.nodes.test import _format_patch_content

        dev = {
            "patches": {
                "file.c": {
                    "diff_content": "",
                    "modified_content": "int main() { return 0; }",
                },
            },
        }
        result = _format_patch_content(dev)
        assert "int main()" in result
