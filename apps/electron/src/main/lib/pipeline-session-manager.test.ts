import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  appendPipelineRecord,
  createPipelineSession,
  getPipelineRecords,
  getPipelineRecordsTail,
  listPipelineSessions,
} from './pipeline-session-manager'

describe('pipeline-session-manager', () => {
  const originalConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
  let tempConfigDir = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-pipeline-session-'))
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    if (originalConfigDir == null) {
      delete process.env.RV_INSIGHTS_CONFIG_DIR
    } else {
      process.env.RV_INSIGHTS_CONFIG_DIR = originalConfigDir
    }

    rmSync(tempConfigDir, { recursive: true, force: true })
  })

  test('创建会话后可追加并读取 JSONL 记录', () => {
    const session = createPipelineSession('测试会话', 'channel-1', 'workspace-1')

    appendPipelineRecord(session.id, {
      id: 'record-1',
      sessionId: session.id,
      type: 'user_input',
      content: '请帮我找一个 RISC-V 贡献点',
      createdAt: Date.now(),
    })

    const records = getPipelineRecords(session.id)
    expect(records).toHaveLength(1)
    expect(records[0]?.type).toBe('user_input')
  })

  test('updatedAt 新的会话排在前面', async () => {
    const first = createPipelineSession('旧会话', 'channel-1', 'workspace-1')
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = createPipelineSession('新会话', 'channel-1', 'workspace-1')

    const sessions = listPipelineSessions()
    expect(sessions[0]?.id).toBe(second.id)
    expect(sessions[1]?.id).toBe(first.id)
  })

  test('getPipelineRecordsTail 会按 append 顺序返回增量 records', () => {
    const session = createPipelineSession('增量记录测试', 'channel-1', 'workspace-1')

    for (let index = 0; index < 3; index += 1) {
      appendPipelineRecord(session.id, {
        id: `record-${index}`,
        sessionId: session.id,
        type: 'user_input',
        content: `任务 ${index}`,
        createdAt: index + 1,
      })
    }

    const firstPage = getPipelineRecordsTail({
      sessionId: session.id,
      afterIndex: 0,
      limit: 2,
    })
    const secondPage = getPipelineRecordsTail({
      sessionId: session.id,
      afterIndex: firstPage.nextIndex,
      limit: 2,
    })

    expect(firstPage.records.map((record) => record.id)).toEqual(['record-0', 'record-1'])
    expect(firstPage.nextIndex).toBe(2)
    expect(firstPage.hasMore).toBe(true)
    expect(secondPage.records.map((record) => record.id)).toEqual(['record-2'])
    expect(secondPage.nextIndex).toBe(3)
    expect(secondPage.hasMore).toBe(false)
  })

  test('getPipelineRecordsTail 对空会话返回稳定 cursor', () => {
    const session = createPipelineSession('空记录测试', 'channel-1', 'workspace-1')

    const result = getPipelineRecordsTail({
      sessionId: session.id,
      afterIndex: 20,
      limit: 20,
    })

    expect(result).toMatchObject({
      sessionId: session.id,
      records: [],
      nextIndex: 0,
      hasMore: false,
    })
  })
})
