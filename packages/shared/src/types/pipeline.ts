/**
 * Pipeline 相关类型定义
 *
 * 定义 RV Pipeline 的会话元数据、记录、流式事件和 IPC 通道常量。
 */

/** Pipeline 固定节点类型 */
export type PipelineNodeKind =
  | 'explorer'
  | 'planner'
  | 'developer'
  | 'reviewer'
  | 'tester'

/** Pipeline 会话状态 */
export type PipelineSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_human'
  | 'node_failed'
  | 'completed'
  | 'terminated'
  | 'recovery_failed'

/** 人工审核动作 */
export type PipelineGateAction =
  | 'approve'
  | 'reject_with_feedback'
  | 'rerun_node'

/** Pipeline 会话元数据 */
export interface PipelineSessionMeta {
  id: string
  title: string
  channelId?: string
  workspaceId?: string
  threadId?: string
  currentNode: PipelineNodeKind
  status: PipelineSessionStatus
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  pendingGate?: PipelineGateRequest | null
  pinned?: boolean
  archived?: boolean
  createdAt: number
  updatedAt: number
}

/** 人工审核请求 */
export interface PipelineGateRequest {
  gateId: string
  sessionId: string
  node: PipelineNodeKind
  title?: string
  summary?: string
  feedbackHint?: string
  iteration: number
  createdAt: number
}

/** 人工审核响应 */
export interface PipelineGateResponse {
  gateId: string
  sessionId: string
  action: PipelineGateAction
  feedback?: string
  createdAt: number
}

export interface PipelineExplorerStageOutput {
  node: 'explorer'
  summary: string
  findings: string[]
  keyFiles: string[]
  nextSteps: string[]
  content: string
}

export interface PipelinePlannerStageOutput {
  node: 'planner'
  summary: string
  steps: string[]
  risks: string[]
  verification: string[]
  content: string
}

export interface PipelineDeveloperStageOutput {
  node: 'developer'
  summary: string
  changes: string[]
  tests: string[]
  risks: string[]
  content: string
}

export interface PipelineReviewerStageOutput {
  node: 'reviewer'
  summary: string
  approved: boolean
  issues: string[]
  content: string
}

export interface PipelineTesterStageOutput {
  node: 'tester'
  summary: string
  commands: string[]
  results: string[]
  blockers: string[]
  content: string
}

export type PipelineStageOutput =
  | PipelineExplorerStageOutput
  | PipelinePlannerStageOutput
  | PipelineDeveloperStageOutput
  | PipelineReviewerStageOutput
  | PipelineTesterStageOutput

export type PipelineStageOutputMap = Partial<Record<PipelineNodeKind, PipelineStageOutput>>

/** 启动 Pipeline 输入 */
export interface PipelineStartInput {
  sessionId: string
  userInput: string
  channelId?: string
  workspaceId?: string
  threadId?: string
}

/** 恢复 Pipeline 输入 */
export interface PipelineResumeInput {
  sessionId: string
  response?: PipelineGateResponse
}

/** 当前 Pipeline 运行快照 */
export interface PipelineStateSnapshot {
  sessionId: string
  currentNode: PipelineNodeKind
  status: PipelineSessionStatus
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  pendingGate?: PipelineGateRequest | null
  stageOutputs?: PipelineStageOutputMap
  updatedAt: number
}

/** 用户输入记录 */
export interface PipelineUserInputRecord {
  id: string
  sessionId: string
  type: 'user_input'
  content: string
  createdAt: number
}

/** 节点切换记录 */
export interface PipelineNodeTransitionRecord {
  id: string
  sessionId: string
  type: 'node_transition'
  toNode: PipelineNodeKind
  fromNode?: PipelineNodeKind
  createdAt: number
}

/** 节点输出记录 */
export interface PipelineNodeOutputRecord {
  id: string
  sessionId: string
  type: 'node_output'
  node: PipelineNodeKind
  content: string
  summary?: string
  createdAt: number
}

/** reviewer 结构化结论 */
export interface PipelineReviewResultRecord {
  id: string
  sessionId: string
  type: 'review_result'
  node: 'reviewer'
  approved: boolean
  summary: string
  issues?: string[]
  createdAt: number
}

/** 阶段结构化产物记录 */
export interface PipelineStageArtifactRecord {
  id: string
  sessionId: string
  type: 'stage_artifact'
  node: PipelineNodeKind
  artifact: PipelineStageOutput
  createdAt: number
}

/** 审核请求记录 */
export interface PipelineGateRequestedRecord {
  id: string
  sessionId: string
  type: 'gate_requested'
  node: PipelineNodeKind
  gateId: string
  summary?: string
  createdAt: number
}

/** 审核结果记录 */
export interface PipelineGateDecisionRecord {
  id: string
  sessionId: string
  type: 'gate_decision'
  node: PipelineNodeKind
  action: PipelineGateAction
  feedback?: string
  createdAt: number
}

/** 状态变更记录 */
export interface PipelineStatusChangeRecord {
  id: string
  sessionId: string
  type: 'status_change'
  status: PipelineSessionStatus
  reason?: string
  createdAt: number
}

/** 错误记录 */
export interface PipelineErrorRecord {
  id: string
  sessionId: string
  type: 'error'
  node?: PipelineNodeKind
  error: string
  createdAt: number
}

/** 持久化记录联合类型 */
export type PipelineRecord =
  | PipelineUserInputRecord
  | PipelineNodeTransitionRecord
  | PipelineNodeOutputRecord
  | PipelineStageArtifactRecord
  | PipelineReviewResultRecord
  | PipelineGateRequestedRecord
  | PipelineGateDecisionRecord
  | PipelineStatusChangeRecord
  | PipelineErrorRecord

/** 流式事件 */
export type PipelineStreamEvent =
  | {
      type: 'node_start'
      node: PipelineNodeKind
      createdAt: number
    }
  | {
      type: 'text_delta'
      node: PipelineNodeKind
      delta: string
      createdAt: number
    }
  | {
      type: 'node_complete'
      node: PipelineNodeKind
      output: string
      summary?: string
      approved?: boolean
      issues?: string[]
      artifact?: PipelineStageOutput
      createdAt: number
    }
  | {
      type: 'status_change'
      status: PipelineSessionStatus
      currentNode: PipelineNodeKind
      createdAt: number
    }
  | {
      type: 'gate_waiting'
      request: PipelineGateRequest
      createdAt: number
    }
  | {
      type: 'gate_resolved'
      response: PipelineGateResponse
      createdAt: number
    }
  | {
      type: 'error'
      error: string
      node?: PipelineNodeKind
      createdAt: number
    }

/** Pipeline 流式载荷 */
export interface PipelineStreamPayload {
  sessionId: string
  event: PipelineStreamEvent
}

/** Pipeline 流结束载荷 */
export interface PipelineStreamCompletePayload {
  sessionId: string
  state: PipelineStateSnapshot
}

/** Pipeline 流错误载荷 */
export interface PipelineStreamErrorPayload {
  sessionId: string
  error: string
}

/** Pipeline IPC 通道 */
export const PIPELINE_IPC_CHANNELS = {
  LIST_SESSIONS: 'pipeline:list-sessions',
  CREATE_SESSION: 'pipeline:create-session',
  GET_RECORDS: 'pipeline:get-records',
  UPDATE_TITLE: 'pipeline:update-title',
  DELETE_SESSION: 'pipeline:delete-session',
  TOGGLE_PIN: 'pipeline:toggle-pin',
  TOGGLE_ARCHIVE: 'pipeline:toggle-archive',
  START: 'pipeline:start',
  RESUME: 'pipeline:resume',
  RESPOND_GATE: 'pipeline:respond-gate',
  STOP: 'pipeline:stop',
  GET_PENDING_GATES: 'pipeline:get-pending-gates',
  GET_SESSION_STATE: 'pipeline:get-session-state',
  STREAM_EVENT: 'pipeline:stream:event',
  STREAM_COMPLETE: 'pipeline:stream:complete',
  STREAM_ERROR: 'pipeline:stream:error',
} as const
