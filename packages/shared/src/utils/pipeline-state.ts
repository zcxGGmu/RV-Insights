import type {
  PipelineGateDecisionRecord,
  PipelineNodeKind,
  PipelineRecord,
  PipelineReviewResultRecord,
  PipelineSessionStatus,
  PipelineStateSnapshot,
} from '../types/pipeline'

const INITIAL_NODE: PipelineNodeKind = 'explorer'

function nextNodeAfterApproval(node: PipelineNodeKind): PipelineNodeKind {
  switch (node) {
    case 'explorer':
      return 'planner'
    case 'planner':
      return 'developer'
    case 'reviewer':
      return 'tester'
    case 'tester':
      return 'tester'
    case 'developer':
    default:
      return node
  }
}

function isTerminalApproval(node: PipelineNodeKind): boolean {
  return node === 'tester'
}

function updateBase(
  state: PipelineStateSnapshot,
  createdAt: number,
  patch: Partial<PipelineStateSnapshot>,
): PipelineStateSnapshot {
  return {
    ...state,
    ...patch,
    updatedAt: createdAt,
  }
}

function applyReviewResult(
  state: PipelineStateSnapshot,
  record: PipelineReviewResultRecord,
): PipelineStateSnapshot {
  if (record.approved) {
    return updateBase(state, record.createdAt, {
      currentNode: 'reviewer',
      status: 'waiting_human',
    })
  }

  return updateBase(state, record.createdAt, {
    currentNode: 'developer',
    status: 'running',
    reviewIteration: state.reviewIteration + 1,
  })
}

function applyGateDecision(
  state: PipelineStateSnapshot,
  record: PipelineGateDecisionRecord,
): PipelineStateSnapshot {
  if (record.action === 'approve') {
    const terminal = isTerminalApproval(record.node)
    return updateBase(state, record.createdAt, {
      currentNode: terminal ? record.node : nextNodeAfterApproval(record.node),
      lastApprovedNode: record.node,
      pendingGate: null,
      status: terminal ? 'completed' : 'running',
    })
  }

  if (record.node === 'reviewer' && record.action === 'reject_with_feedback') {
    return updateBase(state, record.createdAt, {
      currentNode: 'developer',
      pendingGate: null,
      reviewIteration: state.reviewIteration + 1,
      status: 'running',
    })
  }

  return updateBase(state, record.createdAt, {
    currentNode: record.node,
    pendingGate: null,
    status: 'running',
  })
}

/**
 * 创建 Pipeline 初始状态
 */
export function createInitialPipelineState(
  sessionId: string,
  now = Date.now(),
): PipelineStateSnapshot {
  return {
    sessionId,
    currentNode: INITIAL_NODE,
    status: 'idle',
    reviewIteration: 0,
    pendingGate: null,
    updatedAt: now,
  }
}

/**
 * 将一条 Pipeline 记录推进到当前状态
 */
export function applyPipelineRecord(
  state: PipelineStateSnapshot,
  record: PipelineRecord,
): PipelineStateSnapshot {
  switch (record.type) {
    case 'node_transition':
      return updateBase(state, record.createdAt, {
        currentNode: record.toNode,
        status: 'running',
      })
    case 'node_output':
      return updateBase(state, record.createdAt, {
        currentNode: record.node,
      })
    case 'review_result':
      return applyReviewResult(state, record)
    case 'gate_requested':
      return updateBase(state, record.createdAt, {
        currentNode: record.node,
        pendingGate: {
          gateId: record.gateId,
          sessionId: record.sessionId,
          node: record.node,
          summary: record.summary,
          iteration: state.reviewIteration,
          createdAt: record.createdAt,
        },
        status: 'waiting_human',
      })
    case 'gate_decision':
      return applyGateDecision(state, record)
    case 'status_change':
      return updateBase(state, record.createdAt, {
        status: record.status,
      })
    case 'error':
      return updateBase(state, record.createdAt, {
        currentNode: record.node ?? state.currentNode,
        status: 'node_failed',
      })
    case 'user_input':
      return updateBase(state, record.createdAt, {})
    default:
      return state
  }
}

/**
 * 获取可序列化的会话状态
 */
export function serializePipelineState(
  state: PipelineStateSnapshot,
): PipelineStateSnapshot {
  return {
    ...state,
    pendingGate: state.pendingGate ?? null,
  }
}

/**
 * 判断当前状态是否为终态
 */
export function isPipelineTerminalStatus(
  status: PipelineSessionStatus,
): boolean {
  return status === 'completed'
    || status === 'terminated'
    || status === 'recovery_failed'
}
