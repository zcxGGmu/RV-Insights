import { describe, expect, test } from 'bun:test'
import type { PipelineStreamPayload } from '@rv-insights/shared'
import {
  applyPipelineLiveOutput,
  getPipelineLiveOutput,
  hasPipelineLiveOutputNode,
  type PipelineLiveOutputState,
} from './pipeline-atoms'

function payload(event: PipelineStreamPayload['event']): PipelineStreamPayload {
  return {
    sessionId: 'session-1',
    event,
  }
}

describe('applyPipelineLiveOutput', () => {
  test('node_start 会重置当前节点 live buffer，text_delta 会追加文本', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'developer',
      createdAt: 1,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'developer',
      delta: '第一段',
      createdAt: 2,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'developer',
      delta: '第二段',
      createdAt: 3,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).toBe('第一段第二段')

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'developer',
      createdAt: 4,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).toBe('')
  })

  test('node_complete 会清理对应节点，终态会清理整个会话', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'explorer',
      delta: '探索输出',
      createdAt: 1,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'planner',
      delta: '计划输出',
      createdAt: 2,
    }))

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_complete',
      node: 'explorer',
      output: '探索输出',
      createdAt: 3,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'explorer')).toBe('')
    expect(getPipelineLiveOutput(state, 'session-1', 'planner')).toBe('计划输出')

    state = applyPipelineLiveOutput(state, payload({
      type: 'status_change',
      status: 'completed',
      currentNode: 'tester',
      createdAt: 4,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'planner')).toBe('')
  })

  test('失败态保留当前节点 partial output，停止和完成才清理整个会话', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'developer',
      createdAt: 1,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'developer',
      delta: '失败前输出',
      createdAt: 2,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'status_change',
      status: 'node_failed',
      currentNode: 'developer',
      createdAt: 3,
    }))

    expect(hasPipelineLiveOutputNode(state, 'session-1', 'developer')).toBe(true)
    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).toBe('失败前输出')

    state = applyPipelineLiveOutput(state, payload({
      type: 'status_change',
      status: 'terminated',
      currentNode: 'developer',
      createdAt: 4,
    }))

    expect(hasPipelineLiveOutputNode(state, 'session-1', 'developer')).toBe(false)
  })

  test('gate_waiting 会清掉当前节点的 live buffer，避免审核完成后继续显示旧输出', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'reviewer',
      createdAt: 1,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'reviewer',
      delta: '审查输出',
      createdAt: 2,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'gate_waiting',
      request: {
        gateId: 'gate-1',
        sessionId: 'session-1',
        node: 'reviewer',
        iteration: 0,
        createdAt: 3,
      },
      createdAt: 3,
    }))

    expect(hasPipelineLiveOutputNode(state, 'session-1', 'reviewer')).toBe(false)
  })
})
