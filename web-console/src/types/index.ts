// Match backend/app/models/schemas.py CaseStatus exactly (12 states)
export type CaseStatus =
  | 'created'
  | 'exploring'
  | 'pending_explore_review'
  | 'planning'
  | 'pending_plan_review'
  | 'developing'
  | 'reviewing'
  | 'pending_code_review'
  | 'testing'
  | 'pending_test_review'
  | 'completed'
  | 'abandoned'

export interface User {
  id: string
  username: string
  email: string
  role: string
  // Optional alias for backward compatibility with existing payloads
  name?: string
}

export interface CaseCost {
  total_input_tokens: number
  total_output_tokens: number
  estimated_cost_usd: number
}

export interface Case {
  id: string
  title: string
  status: CaseStatus
  target_repo: string
  owner_id: string
  input_context?: string
  contribution_type?: string
  thread_id?: string // LangGraph thread ID (added in Sprint 2)
  exploration_result?: ExplorationResult
  execution_plan?: ExecutionPlan
  development_result?: DevelopmentResult
  review_verdict?: ReviewVerdict
  test_result?: TestResult
  review_iterations?: number
  created_at?: string
  updated_at?: string
  cost?: CaseCost
}

// Pipeline-related types (referenced by Case fields above)
export type EventType =
  | 'stage_change'
  | 'agent_output'
  | 'review_request'
  | 'iteration_update'
  | 'cost_update'
  | 'error'
  | 'completed'
  | 'heartbeat'

export interface PipelineEvent {
  seq: number
  case_id: string
  event_type: EventType
  data: Record<string, any>
  timestamp: string
}

export type ReviewAction = 'approve' | 'reject' | 'abandon'

export interface ReviewDecision {
  action: ReviewAction
  comment?: string
}

// Pipeline stage visualization
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_review'

export interface PipelineStage {
  id: string
  label: string
  status: StageStatus
  startedAt?: string
  completedAt?: string
}

// Evidence (for ExplorationResult)
export interface Evidence {
  source: string
  url?: string
  content: string
  relevance: number
}

// Stage result types (match backend Pydantic models)
export interface ExplorationResult {
  contribution_type: string
  title: string
  summary: string
  target_repo: string
  target_files: string[]
  evidence: Evidence[]
  feasibility_score: number
  estimated_complexity: string
  upstream_status: string
}

export interface DevStep {
  id: string
  description: string
  target_files: string[]
  expected_changes: string
  risk_level: string
  dependencies: string[]
}

export interface TestCase {
  id: string
  name: string
  type: string
  description: string
  expected_result: string
  qemu_required: boolean
}

export interface ExecutionPlan {
  dev_steps: DevStep[]
  test_cases: TestCase[]
  qemu_config?: Record<string, any>
  estimated_tokens: number
  risk_assessment: string
}

export interface DevelopmentResult {
  patch_files: string[]
  changed_files: string[]
  commit_message: string
  change_summary: string
  lines_added: number
  lines_removed: number
}

export interface ReviewFinding {
  severity: string
  category: string
  file?: string
  line?: number
  description: string
  suggestion?: string
}

export interface ReviewVerdict {
  approved: boolean
  findings: ReviewFinding[]
  iteration: number
  reviewer_model: string
  summary: string
}

export interface TestResult {
  passed: boolean
  total_tests: number
  passed_tests: number
  failed_tests: number
  test_log_path: string
  coverage_percent?: number
  qemu_version?: string
  failure_details: string[]
}
