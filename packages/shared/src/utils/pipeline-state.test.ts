import { describe, expect, test } from 'bun:test'
import { applyPipelineRecord, createInitialPipelineState } from './pipeline-state'

describe('pipeline-state', () => {
  test('reviewer 驳回后回到 developer 并增加轮次', () => {
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
})
