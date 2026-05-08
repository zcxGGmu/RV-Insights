import type {
  PipelineGateDecisionRecord,
  PipelineNodeKind,
  PipelineRecord,
  PipelineReviewResultRecord,
  PipelineStageArtifactRecord,
  PipelineSessionMeta,
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
  return updateBase(state, record.createdAt, {
    currentNode: 'reviewer',
    status: 'waiting_human',
  })
}

function applyStageArtifact(
  state: PipelineStateSnapshot,
  record: PipelineStageArtifactRecord,
): PipelineStateSnapshot {
  return updateBase(state, record.createdAt, {
    currentNode: record.node,
    stageOutputs: {
      ...(state.stageOutputs ?? {}),
      [record.node]: record.artifact,
    },
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
    stageOutputs: {},
    updatedAt: now,
  }
}

/**
 * 从会话索引缓存构造 Pipeline 状态快照。
 *
 * 运行中以 graph snapshot 为权威；历史回放以 records reducer 为权威；
 * session meta 只作为查询索引和缓存，因此进入 reducer 前需要显式转换。
 */
export function createPipelineStateFromSessionMeta(
  meta: PipelineSessionMeta,
): PipelineStateSnapshot {
  return {
    sessionId: meta.id,
    currentNode: meta.currentNode,
    status: meta.status,
    reviewIteration: meta.reviewIteration,
    lastApprovedNode: meta.lastApprovedNode,
    pendingGate: meta.pendingGate ?? null,
    stageOutputs: {},
    updatedAt: meta.updatedAt,
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
    case 'stage_artifact':
      return applyStageArtifact(state, record)
    case 'review_result':
      return applyReviewResult(state, record)
    case 'gate_requested':
      return updateBase(state, record.createdAt, {
        currentNode: record.node,
        reviewIteration: record.iteration ?? state.reviewIteration,
        pendingGate: {
          gateId: record.gateId,
          sessionId: record.sessionId,
          node: record.node,
          title: record.title,
          summary: record.summary,
          feedbackHint: record.feedbackHint,
          iteration: record.iteration ?? state.reviewIteration,
          createdAt: record.createdAt,
        },
        status: 'waiting_human',
      })
    case 'gate_decision':
      return applyGateDecision(state, record)
    case 'status_change':
      return updateBase(state, record.createdAt, {
        status: record.status,
        pendingGate: record.status === 'waiting_human' ? state.pendingGate : null,
      })
    case 'error':
      return updateBase(state, record.createdAt, {
        currentNode: record.node ?? state.currentNode,
        status: 'node_failed',
        pendingGate: null,
      })
    case 'user_input':
      return updateBase(state, record.createdAt, {})
    default:
      return state
  }
}

/**
 * 从 Pipeline records 回放完整状态。
 */
export function replayPipelineRecords(
  sessionId: string,
  records: readonly PipelineRecord[],
  now = Date.now(),
): PipelineStateSnapshot {
  return serializePipelineState(
    records.reduce(
      (state, record) => applyPipelineRecord(state, record),
      createInitialPipelineState(sessionId, records[0]?.createdAt ?? now),
    ),
  )
}

export interface PipelineSessionStatePatch {
  currentNode: PipelineNodeKind
  status: PipelineSessionStatus
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  pendingGate: PipelineStateSnapshot['pendingGate']
}

/**
 * 将权威状态转换为 session meta 可缓存字段。
 */
export function buildPipelineSessionStatePatch(
  state: PipelineStateSnapshot,
): PipelineSessionStatePatch {
  return {
    currentNode: state.currentNode,
    status: state.status,
    reviewIteration: state.reviewIteration,
    lastApprovedNode: state.lastApprovedNode,
    pendingGate: state.pendingGate ?? null,
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
    stageOutputs: state.stageOutputs ?? {},
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
