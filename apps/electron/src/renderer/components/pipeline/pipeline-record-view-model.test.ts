import { describe, expect, test } from 'bun:test'
import { buildPipelineRecordViewModel } from './pipeline-record-view-model'

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
      badge: 'REVIEW',
      title: 'Reviewer 需要修改',
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
      badge: 'DEVELOPER',
      title: 'DEVELOPER 输出',
      summary: '已修改 3 个文件',
      details: '已修改 3 个文件\n- a.ts\n- b.ts\n- c.ts',
      tone: 'neutral',
    })
  })
})
