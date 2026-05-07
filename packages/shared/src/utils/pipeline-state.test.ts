import { describe, expect, test } from 'bun:test'
import { applyPipelineRecord, createInitialPipelineState } from './pipeline-state'

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
})
