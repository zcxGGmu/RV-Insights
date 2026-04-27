export type CaseStatus =
  | 'created'
  | 'exploring'
  | 'planning'
  | 'developing'
  | 'reviewing'
  | 'testing'
  | 'pending'
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
  exploration_result?: any
  execution_plan?: any
  development_result?: any
  review_verdict?: any
  test_result?: any
  review_iterations?: number
  created_at?: string
  updated_at?: string
  cost?: CaseCost
}
