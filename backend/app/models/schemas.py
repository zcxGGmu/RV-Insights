from enum import Enum
from datetime import datetime, timedelta
from typing import List, Optional, Dict

from pydantic import BaseModel, Field, EmailStr


class CaseStatus(str, Enum):
    created = "created"
    exploring = "exploring"
    pending_explore_review = "pending_explore_review"
    planning = "planning"
    pending_plan_review = "pending_plan_review"
    developing = "developing"
    reviewing = "reviewing"
    pending_code_review = "pending_code_review"
    testing = "testing"
    pending_test_review = "pending_test_review"
    completed = "completed"
    abandon = "abandoned"


class UserRole(str, Enum):
    admin = "admin"
    reviewer = "reviewer"
    viewer = "viewer"


# Auth schemas
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(min_length=8)

    model_config = {
        "extra": "forbid",
    }


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = Field(default="bearer")


class RefreshRequest(BaseModel):
    refresh_token: str


# Cost
class CostSummary(BaseModel):
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    estimated_cost_usd: float = 0.0


# Evidence
class Evidence(BaseModel):
    source: str
    url: Optional[str] = None
    content: str
    relevance: float


# Exploration
class ExplorationResult(BaseModel):
    contribution_type: str
    title: str
    summary: str
    target_repo: str
    target_files: List[str]
    evidence: List[Evidence]
    feasibility_score: float
    estimated_complexity: str
    upstream_status: str


# Plan
class DevStep(BaseModel):
    id: str
    description: str
    target_files: List[str]
    expected_changes: str
    risk_level: str
    dependencies: List[str]


class TestCase(BaseModel):
    id: str
    name: str
    type: str
    description: str
    expected_result: str
    qemu_required: bool


class ExecutionPlan(BaseModel):
    dev_steps: List[DevStep]
    test_cases: List[TestCase]
    qemu_config: Optional[Dict] = None
    estimated_tokens: int
    risk_assessment: str


# Development
class PatchFile(BaseModel):
    filename: str
    original_content: str = ""
    modified_content: str = ""
    diff_content: str = ""
    language: str = "c"


class DevelopmentResult(BaseModel):
    patch_files: List[str]
    patches: Dict[str, PatchFile] = {}
    changed_files: List[str]
    commit_message: str
    change_summary: str
    lines_added: int
    lines_removed: int


# Review
class ReviewFinding(BaseModel):
    severity: str
    category: str
    file: Optional[str] = None
    line: Optional[int] = None
    description: str
    suggestion: Optional[str] = None


class ReviewVerdict(BaseModel):
    approved: bool
    findings: List[ReviewFinding]
    iteration: int
    reviewer_model: str
    summary: str


# Test
class TestResult(BaseModel):
    passed: bool
    total_tests: int
    passed_tests: int
    failed_tests: int
    test_log_path: str
    coverage_percent: Optional[float] = None
    qemu_version: Optional[str] = None
    failure_details: List[str] = []


# Case
class CaseCreate(BaseModel):
    title: str
    target_repo: str
    input_context: str
    contribution_type: Optional[str] = None


class CaseResponse(BaseModel):
    id: str
    title: str
    status: CaseStatus
    target_repo: str
    input_context: str
    owner_id: str
    exploration_result: Optional[ExplorationResult] = None
    execution_plan: Optional[ExecutionPlan] = None
    development_result: Optional[DevelopmentResult] = None
    review_verdict: Optional[ReviewVerdict] = None
    test_result: Optional[TestResult] = None
    review_iterations: int = 0
    created_at: datetime
    updated_at: datetime
    cost: CostSummary


class CaseListResponse(BaseModel):
    items: List[CaseResponse]
    total: int
    page: int
    per_page: int


# Pipeline
class ReviewAction(str, Enum):
    approve = "approve"
    reject = "reject"
    abandon = "abandon"


class ReviewDecision(BaseModel):
    action: ReviewAction
    comment: Optional[str] = None
    review_id: Optional[str] = None


# Pipeline events
class EventType(str, Enum):
    stage_change = "stage_change"
    agent_output = "agent_output"
    review_request = "review_request"
    iteration_update = "iteration_update"
    cost_update = "cost_update"
    error = "error"
    completed = "completed"
    heartbeat = "heartbeat"


class PipelineEvent(BaseModel):
    seq: int
    case_id: str
    event_type: EventType
    data: Dict
    timestamp: datetime


# Error
class ErrorResponse(BaseModel):
    detail: str
    status_code: int
