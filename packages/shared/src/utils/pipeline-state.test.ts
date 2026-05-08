import { describe, expect, test } from 'bun:test'
import {
  applyPipelineRecord,
  buildPipelineSessionStatePatch,
  createInitialPipelineState,
  createPipelineStateFromSessionMeta,
  replayPipelineRecords,
} from './pipeline-state'

describe('pipeline-state', () => {
  test('reviewer 输出驳回结论后仍先等待人工审核', () => {
    const state = createInitialPipelineState('session-1')

    const next = applyPipelineRecord(state, {
      id: 'record-1',
      sessionId: 'session-1',
      type: 'review_result',
      node: 'reviewer',
      approved: false,
      summary: '缺少测试',
      createdAt: Date.now(),
    })

    expect(next.currentNode).toBe('reviewer')
    expect(next.reviewIteration).toBe(0)
    expect(next.status).toBe('waiting_human')
  })

  test('人工驳回 reviewer 后回到 developer 并增加轮次', () => {
    const state = createInitialPipelineState('session-1')

    const next = applyPipelineRecord(state, {
      id: 'record-2',
      sessionId: 'session-1',
      type: 'gate_decision',
      node: 'reviewer',
      action: 'reject_with_feedback',
      feedback: '请补测试',
      createdAt: Date.now(),
    })

    expect(next.currentNode).toBe('developer')
    expect(next.reviewIteration).toBe(1)
    expect(next.status).toBe('running')
  })

  test('tester 审核通过后进入 completed', () => {
    const state = createInitialPipelineState('session-2')

    const next = applyPipelineRecord(state, {
      id: 'record-2',
      sessionId: 'session-2',
      type: 'gate_decision',
      node: 'tester',
      action: 'approve',
      createdAt: Date.now(),
    })

    expect(next.currentNode).toBe('tester')
    expect(next.lastApprovedNode).toBe('tester')
    expect(next.status).toBe('completed')
  })

  test('stage_artifact 会写入状态中的阶段产物映射', () => {
    const state = createInitialPipelineState('session-3')

    const next = applyPipelineRecord(state, {
      id: 'record-3',
      sessionId: 'session-3',
      type: 'stage_artifact',
      node: 'planner',
      artifact: {
        node: 'planner',
        summary: '按三步实现',
        steps: ['补测试', '改实现', '跑验证'],
        risks: ['回归风险'],
        verification: ['bun test'],
        content: '{"summary":"按三步实现"}',
      },
      createdAt: Date.now(),
    })

    expect(next.currentNode).toBe('planner')
    expect(next.stageOutputs?.planner?.summary).toBe('按三步实现')
  })

  test('records replay 能恢复 pendingGate、reviewIteration 和终态', () => {
    const state = replayPipelineRecords('session-4', [
      {
        id: 'record-1',
        sessionId: 'session-4',
        type: 'gate_requested',
        node: 'reviewer',
        gateId: 'gate-1',
        title: '审查待确认',
        summary: '缺少测试',
        feedbackHint: '请填写反馈',
        iteration: 2,
        createdAt: 10,
      },
      {
        id: 'record-2',
        sessionId: 'session-4',
        type: 'gate_decision',
        node: 'reviewer',
        action: 'reject_with_feedback',
        feedback: '请补测试',
        createdAt: 20,
      },
      {
        id: 'record-3',
        sessionId: 'session-4',
        type: 'gate_decision',
        node: 'tester',
        action: 'approve',
        createdAt: 30,
      },
    ])

    expect(state.pendingGate).toBeNull()
    expect(state.reviewIteration).toBe(3)
    expect(state.lastApprovedNode).toBe('tester')
    expect(state.status).toBe('completed')
    expect(state.updatedAt).toBe(30)
  })

  test('node_failed / terminated replay 会清理 pendingGate', () => {
    const waiting = applyPipelineRecord(createInitialPipelineState('session-5'), {
      id: 'record-1',
      sessionId: 'session-5',
      type: 'gate_requested',
      node: 'planner',
      gateId: 'gate-1',
      createdAt: 10,
    })

    const failed = applyPipelineRecord(waiting, {
      id: 'record-2',
      sessionId: 'session-5',
      type: 'error',
      node: 'planner',
      error: '执行失败',
      createdAt: 20,
    })

    expect(failed.status).toBe('node_failed')
    expect(failed.pendingGate).toBeNull()

    const terminated = applyPipelineRecord(waiting, {
      id: 'record-3',
      sessionId: 'session-5',
      type: 'status_change',
      status: 'terminated',
      createdAt: 30,
    })

    expect(terminated.status).toBe('terminated')
    expect(terminated.pendingGate).toBeNull()
  })

  test('session meta 可以转换为 replay state 并导出 session patch', () => {
    const state = createPipelineStateFromSessionMeta({
      id: 'session-6',
      title: '测试会话',
      currentNode: 'reviewer',
      status: 'waiting_human',
      reviewIteration: 2,
      pendingGate: {
        gateId: 'gate-1',
        sessionId: 'session-6',
        node: 'reviewer',
        iteration: 2,
        createdAt: 50,
      },
      createdAt: 1,
      updatedAt: 60,
    })

    expect(buildPipelineSessionStatePatch(state)).toEqual({
      currentNode: 'reviewer',
      status: 'waiting_human',
      reviewIteration: 2,
      lastApprovedNode: undefined,
      pendingGate: {
        gateId: 'gate-1',
        sessionId: 'session-6',
        node: 'reviewer',
        iteration: 2,
        createdAt: 50,
      },
    })
  })
})
