import { describe, expect, test } from 'bun:test'
import {
  buildPipelineRecordGroups,
  buildPipelineRecordViewModel,
} from './pipeline-record-view-model'

describe('buildPipelineRecordViewModel', () => {
  test('review_result 会生成结构化 reviewer 卡片', () => {
    const viewModel = buildPipelineRecordViewModel({
      id: 'review-1',
      sessionId: 'session-1',
      type: 'review_result',
      node: 'reviewer',
      approved: false,
      summary: '缺少测试覆盖',
      issues: ['缺少测试', '没有验证步骤'],
      createdAt: 1,
    })

    expect(viewModel).toEqual({
      badge: '审查结论',
      title: '审查需要修改',
      summary: '缺少测试覆盖',
      bullets: ['缺少测试', '没有验证步骤'],
      tone: 'warning',
    })
  })

  test('node_output 在 summary 与 content 不同时保留 details', () => {
    const viewModel = buildPipelineRecordViewModel({
      id: 'output-1',
      sessionId: 'session-1',
      type: 'node_output',
      node: 'developer',
      summary: '已修改 3 个文件',
      content: '已修改 3 个文件\n- a.ts\n- b.ts\n- c.ts',
      createdAt: 1,
    })

    expect(viewModel).toEqual({
      badge: '开发',
      title: '开发输出',
      summary: '已修改 3 个文件',
      details: '已修改 3 个文件\n- a.ts\n- b.ts\n- c.ts',
      tone: 'neutral',
    })
  })

  test('records 会拆成阶段产物和运行日志', () => {
    const groups = buildPipelineRecordGroups([
      {
        id: 'input-1',
        sessionId: 'session-1',
        type: 'user_input',
        content: '优化 Pipeline UI',
        createdAt: 1,
      },
      {
        id: 'transition-1',
        sessionId: 'session-1',
        type: 'node_transition',
        toNode: 'explorer',
        createdAt: 2,
      },
      {
        id: 'output-1',
        sessionId: 'session-1',
        type: 'node_output',
        node: 'explorer',
        content: '探索结论',
        createdAt: 3,
      },
      {
        id: 'status-1',
        sessionId: 'session-1',
        type: 'status_change',
        status: 'completed',
        createdAt: 4,
      },
    ])

    expect(groups.artifacts.map((group) => ({
      id: group.id,
      title: group.title,
      recordIds: group.records.map((record) => record.id),
    }))).toEqual([
      {
        id: 'task',
        title: '任务输入',
        recordIds: ['input-1'],
      },
      {
        id: 'explorer',
        title: '探索',
        recordIds: ['output-1'],
      },
    ])
    expect(groups.logs.map((record) => record.id)).toEqual([
      'transition-1',
      'status-1',
    ])
  })
})
