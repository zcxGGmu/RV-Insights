import { describe, expect, test } from 'bun:test'
import type { PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'
import {
  buildPipelineGateViewModel,
  buildPipelineFailureViewModel,
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

  test('Gate view model 按节点给出清晰的动作语义', () => {
    expect(buildPipelineGateViewModel({
      gateId: 'gate-1',
      sessionId: 'session-1',
      node: 'planner',
      iteration: 0,
      createdAt: 1,
    })).toMatchObject({
      title: '计划节点待确认',
      iterationLabel: '第 1 轮',
      approveLabel: '确认计划，进入开发',
      rejectLabel: '要求修改',
      rerunLabel: '重跑计划',
      rejectRequiresFeedback: true,
    })

    expect(buildPipelineGateViewModel({
      gateId: 'gate-2',
      sessionId: 'session-1',
      node: 'tester',
      iteration: 2,
      createdAt: 1,
    })).toMatchObject({
      title: '测试节点待确认',
      iterationLabel: '第 3 轮',
      approveLabel: '确认完成',
      rerunLabel: '重跑测试',
    })
  })

  test('Failure view model 能显示失败节点、错误详情和恢复入口', () => {
    expect(buildPipelineFailureViewModel({
      state: {
        sessionId: 'session-1',
        currentNode: 'developer',
        status: 'node_failed',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: 1,
      },
      error: '构建失败',
      partialOutput: '最后一段输出',
    })).toMatchObject({
      title: '开发节点执行失败',
      nodeLabel: '开发',
      detailLabel: '错误详情',
      message: '构建失败',
      partialOutputLabel: '失败前输出',
      partialOutput: '最后一段输出',
      restartLabel: '重新启动 Pipeline',
      settingsLabel: '打开 Agent 设置',
    })

    expect(buildPipelineFailureViewModel({
      state: {
        sessionId: 'session-1',
        currentNode: 'tester',
        status: 'running',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: 1,
      },
      error: '仍在运行',
    })).toBeNull()
  })
})
