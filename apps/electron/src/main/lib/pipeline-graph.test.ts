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

  test('getState 会从 checkpoint interrupt 回填 pendingGate', async () => {
    const checkpointer = new MemorySaver()
    const graph = createPipelineGraph({
      checkpointer,
      runNode: async (node) => ({
        output: `${node}-ok`,
        summary: `${node}-ok`,
        approved: true,
      }),
    })

    const interrupted = await graph.invoke({
      sessionId: 'session-state-gate',
      userInput: '请执行到人工审核',
    })

    const state = await graph.getState('session-state-gate')

    expect(interrupted.interrupted?.node).toBe('explorer')
    expect(state.status).toBe('waiting_human')
    expect(state.pendingGate).toMatchObject({
      gateId: interrupted.interrupted?.gateId,
      sessionId: 'session-state-gate',
      node: 'explorer',
    })
  })

  test('下游节点可以读取上游阶段产物，快照保留 stageOutputs', async () => {
    const developerContextSummaries: string[] = []

    const graph = createPipelineGraph({
      checkpointer: new MemorySaver(),
      runNode: async (node, context) => {
        if (node === 'developer') {
          developerContextSummaries.push(context.stageOutputs?.planner?.summary ?? '')
        }

        if (node === 'explorer') {
          return {
            output: '{"summary":"已定位入口"}',
            summary: '已定位入口',
            approved: true,
            stageOutput: {
              node: 'explorer',
              summary: '已定位入口',
              findings: ['入口在 PipelineView'],
              keyFiles: ['PipelineView.tsx'],
              nextSteps: ['制定计划'],
              content: '{"summary":"已定位入口"}',
            },
          }
        }

        if (node === 'planner') {
          return {
            output: '{"summary":"按三步实现"}',
            summary: '按三步实现',
            approved: true,
            stageOutput: {
              node: 'planner',
              summary: '按三步实现',
              steps: ['补测试', '改实现', '跑验证'],
              risks: ['状态回归'],
              verification: ['bun test'],
              content: '{"summary":"按三步实现"}',
            },
          }
        }

        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-stage-output',
      userInput: '请实现结构化产物',
    })

    const plannerPause = await graph.resume({
      sessionId: 'session-stage-output',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-stage-output',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const reviewerPause = await graph.resume({
      sessionId: 'session-stage-output',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-stage-output',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(developerContextSummaries).toEqual(['按三步实现'])
    expect(reviewerPause.state.stageOutputs?.explorer?.summary).toBe('已定位入口')
    expect(reviewerPause.state.stageOutputs?.planner?.summary).toBe('按三步实现')
  })
})
