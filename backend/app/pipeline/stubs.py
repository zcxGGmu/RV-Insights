"""Stub result factories for pipeline nodes (used as fallbacks)."""

from __future__ import annotations


def _stub_exploration_result() -> dict:
    return {
        "contribution_type": "bugfix",
        "title": "Stub exploration",
        "summary": "Placeholder exploration result from stub node",
        "target_repo": "stub/repo",
        "target_files": ["stub.py"],
        "evidence": [],
        "feasibility_score": 0.8,
        "estimated_complexity": "low",
        "upstream_status": "open",
    }


def _stub_execution_plan() -> dict:
    return {
        "dev_steps": [{
            "id": "s1", "description": "Stub step", "target_files": ["stub.py"],
            "expected_changes": "none", "risk_level": "low", "dependencies": [],
        }],
        "test_cases": [{
            "id": "t1", "name": "Stub test", "type": "unit", "description": "Stub",
            "expected_result": "pass", "qemu_required": False,
        }],
        "estimated_tokens": 0,
        "risk_assessment": "low",
    }


def _stub_development_result() -> dict:
    return {
        "patch_files": [],
        "changed_files": ["stub.py"],
        "commit_message": "stub: placeholder commit",
        "change_summary": "Stub development result",
        "lines_added": 0,
        "lines_removed": 0,
    }


def _stub_review_verdict(iteration: int) -> dict:
    return {
        "approved": True,
        "findings": [],
        "iteration": iteration,
        "reviewer_model": "stub",
        "summary": "Stub review: auto-approved",
    }


def _stub_test_result() -> dict:
    return {
        "passed": True,
        "total_tests": 1,
        "passed_tests": 1,
        "failed_tests": 0,
        "test_log_path": "/tmp/stub_test.log",
        "failure_details": [],
    }
