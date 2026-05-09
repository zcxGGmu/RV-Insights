import { describe, expect, test } from 'bun:test'
import type { SDKSystemMessage } from '@rv-insights/shared'
import {
  TeamsCoordinator,
  type TeamInboxMessage,
  type TeamsCoordinatorDeps,
} from './teams-coordinator'

function systemMessage(input: Omit<SDKSystemMessage, 'type'>): SDKSystemMessage {
  return { type: 'system', ...input }
}

describe('TeamsCoordinator', () => {
  test('追踪 task_started / task_notification 并判断 result 延迟与 Watchdog 检查', () => {
    const coordinator = new TeamsCoordinator('sdk-session-1')

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'local_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-2',
      task_type: 'remote_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'ignored-task',
      task_type: 'other',
    }))

    expect(coordinator.startedTaskCount).toBe(2)
    expect(coordinator.shouldDeferResultMessage()).toBe(true)
    expect(coordinator.shouldCheckWorkerIdle()).toBe(true)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-1',
      status: 'completed',
      summary: '第一项任务完成',
      output_file: '/tmp/task-1.md',
    }))

    expect(coordinator.summaryCount).toBe(1)
    expect(coordinator.shouldCheckWorkerIdle()).toBe(true)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-2',
      status: 'completed',
    }))

    expect(coordinator.summaryCount).toBe(1)
    expect(coordinator.shouldCheckWorkerIdle()).toBe(false)
  })

  test('Watchdog idle 检查使用捕获到的 SDK session 和 started task 数量', async () => {
    const calls: Array<{ sdkSessionId: string; startedCount: number }> = []
    const coordinator = new TeamsCoordinator('sdk-session-1', {
      areAllWorkersIdle: async (sdkSessionId, startedCount) => {
        calls.push({ sdkSessionId, startedCount })
        return true
      },
    })

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'local_agent',
    }))

    await expect(coordinator.areWorkersIdle()).resolves.toBe(true)
    expect(calls).toEqual([{ sdkSessionId: 'sdk-session-1', startedCount: 1 }])
  })

  test('构造 resume prompt 时优先使用 inbox 并标记已读', async () => {
    const markedPaths: string[] = []
    const inboxMessages: TeamInboxMessage[] = [
      { from: 'worker-1', text: '完整结果', summary: '摘要' },
    ]
    const deps: TeamsCoordinatorDeps = {
      findTeamLeadInboxPath: async () => ({ teamName: 'alpha', inboxPath: '/tmp/inbox.json' }),
      pollInboxWithRetry: async () => inboxMessages,
      markInboxAsRead: async (inboxPath) => {
        markedPaths.push(inboxPath)
      },
      formatInboxPrompt: (messages) => `inbox:${messages.length}:${messages[0]?.text ?? ''}`,
      formatSummaryFallbackPrompt: () => 'summary:fallback',
    }
    const coordinator = new TeamsCoordinator('sdk-session-1', deps)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'local_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-1',
      status: 'completed',
      summary: '摘要 fallback',
    }))

    const result = await coordinator.buildResumePrompt()

    expect(result).toEqual({
      prompt: 'inbox:1:完整结果',
      source: 'inbox',
      teamName: 'alpha',
      inboxMessageCount: 1,
      summaryCount: 1,
    })
    expect(markedPaths).toEqual(['/tmp/inbox.json'])
  })

  test('inbox 为空时使用 task_notification summaries 作为 fallback', async () => {
    const deps: TeamsCoordinatorDeps = {
      findTeamLeadInboxPath: async () => ({ teamName: 'alpha', inboxPath: '/tmp/inbox.json' }),
      pollInboxWithRetry: async () => [],
      markInboxAsRead: async () => {
        throw new Error('不应标记空 inbox')
      },
      formatSummaryFallbackPrompt: (summaries) => `summary:${summaries.length}:${summaries[0]?.summary ?? ''}`,
    }
    const coordinator = new TeamsCoordinator('sdk-session-1', deps)

    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_started',
      task_id: 'task-1',
      task_type: 'remote_agent',
    }))
    coordinator.recordSystemMessage(systemMessage({
      subtype: 'task_notification',
      task_id: 'task-1',
      status: 'completed',
      summary: '完成摘要',
    }))

    const result = await coordinator.buildResumePrompt()

    expect(result).toEqual({
      prompt: 'summary:1:完成摘要',
      source: 'summary',
      teamName: 'alpha',
      inboxMessageCount: 0,
      summaryCount: 1,
    })
  })
})
