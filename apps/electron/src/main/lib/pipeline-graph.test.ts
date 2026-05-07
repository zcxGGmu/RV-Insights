import { describe, expect, test } from 'bun:test'
import { MemorySaver } from '@langchain/langgraph'
import { createPipelineGraph } from './pipeline-graph'

describe('pipeline-graph', () => {
  test('reviewer 首次拒绝后仍进入 reviewer gate，人工驳回后回到 developer 并再次审核', async () => {
    let reviewerCount = 0

    const graph = createPipelineGraph({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        if (node === 'reviewer') {
          reviewerCount += 1
          if (reviewerCount === 1) {
            return {
              output: '缺少测试',
              summary: '缺少测试',
              approved: false,
              issues: ['缺少测试'],
            }
          }
        }

        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const first = await graph.invoke({
      sessionId: 'session-review-loop',
      userInput: '请修复 pipeline',
    })
    expect(first.interrupted?.node).toBe('explorer')

    const second = await graph.resume({
      sessionId: 'session-review-loop',
      response: {
        gateId: first.interrupted!.gateId,
        sessionId: 'session-review-loop',
        action: 'approve',
        createdAt: Date.now(),
      },
    })
    expect(second.interrupted?.node).toBe('planner')

    const third = await graph.resume({
      sessionId: 'session-review-loop',
      response: {
        gateId: second.interrupted!.gateId,
        sessionId: 'session-review-loop',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(third.interrupted?.node).toBe('reviewer')
    expect(third.state.reviewIteration).toBe(0)
    expect(third.state.currentNode).toBe('reviewer')

    const fourth = await graph.resume({
      sessionId: 'session-review-loop',
      response: {
        gateId: third.interrupted!.gateId,
        sessionId: 'session-review-loop',
        action: 'reject_with_feedback',
        feedback: '请补测试',
        createdAt: Date.now(),
      },
    })

    expect(fourth.interrupted?.node).toBe('reviewer')
    expect(fourth.state.reviewIteration).toBe(1)
    expect(fourth.state.currentNode).toBe('reviewer')
  })

  test('tester 审核通过后进入 completed', async () => {
    const graph = createPipelineGraph({
      checkpointer: new MemorySaver(),
      runNode: async (node) => ({
        output: `${node}-ok`,
        summary: `${node}-ok`,
        approved: true,
      }),
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-complete',
      userInput: '请完成任务',
    })

    const plannerPause = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const reviewerPause = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const testerPause = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: reviewerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const completed = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: testerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(completed.interrupted).toBeUndefined()
    expect(completed.state.status).toBe('completed')
    expect(completed.state.lastApprovedNode).toBe('tester')
  })
})
