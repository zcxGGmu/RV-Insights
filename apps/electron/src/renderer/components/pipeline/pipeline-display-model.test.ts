import { describe, expect, test } from 'bun:test'
import type { PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'
import {
  buildPipelineHeaderViewModel,
  buildPipelineStageViewModels,
  getPipelineNodeLabel,
  getPipelineStatusDisplay,
} from './pipeline-display-model'

function makeSession(patch: Partial<PipelineSessionMeta> = {}): PipelineSessionMeta {
  return {
    id: 'session-1',
    title: '优化 Pipeline UI',
    channelId: 'channel-1',
    workspaceId: 'workspace-1',
    currentNode: 'explorer',
    status: 'idle',
    reviewIteration: 0,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  }
}

function makeState(patch: Partial<PipelineStateSnapshot> = {}): PipelineStateSnapshot {
  return {
    sessionId: 'session-1',
    currentNode: 'explorer',
    status: 'idle',
    reviewIteration: 0,
    pendingGate: null,
    updatedAt: 1,
    ...patch,
  }
}

describe('pipeline display model', () => {
  test('状态与节点不会把 raw enum 泄露给 UI', () => {
    expect(getPipelineStatusDisplay('node_failed')).toEqual({
      label: '节点失败',
      tone: 'failed',
    })
    expect(getPipelineStatusDisplay('waiting_human')).toEqual({
      label: '等待人工审核',
      tone: 'waiting',
    })
    expect(getPipelineNodeLabel('developer')).toBe('开发')
  })

  test('Header view model 合并 session 与 state，并显示节点、状态和轮次', () => {
    const viewModel = buildPipelineHeaderViewModel({
      session: makeSession(),
      state: makeState({
        currentNode: 'reviewer',
        status: 'node_failed',
        reviewIteration: 2,
      }),
    })

    expect(viewModel).toEqual({
      title: '优化 Pipeline UI',
      eyebrow: 'RV Pipeline',
      statusLabel: '节点失败',
      statusTone: 'failed',
      nodeLabel: '审查',
      summary: '审查节点失败',
      metaItems: ['第 3 轮'],
    })
  })

  test('StageRail 会把 lastApprovedNode 之前的阶段连续标记为完成', () => {
    const stages = buildPipelineStageViewModels(makeState({
      currentNode: 'developer',
      lastApprovedNode: 'planner',
      status: 'running',
    }))

    expect(stages.map((stage) => [stage.node, stage.status])).toEqual([
      ['explorer', 'done'],
      ['planner', 'done'],
      ['developer', 'active'],
      ['reviewer', 'todo'],
      ['tester', 'todo'],
    ])
  })

  test('StageRail 能表达等待人工审核与失败态', () => {
    expect(buildPipelineStageViewModels(makeState({
      currentNode: 'planner',
      status: 'waiting_human',
      lastApprovedNode: 'explorer',
    })).map((stage) => stage.status)).toEqual(['done', 'waiting', 'todo', 'todo', 'todo'])

    expect(buildPipelineStageViewModels(makeState({
      currentNode: 'tester',
      status: 'node_failed',
      lastApprovedNode: 'reviewer',
    })).map((stage) => stage.status)).toEqual(['done', 'done', 'done', 'done', 'failed'])
  })
})
