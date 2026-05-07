import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type {
  PipelineGateRequest,
  PipelineGateResponse,
  PipelineStateSnapshot,
  PipelineStreamPayload,
} from '@rv-insights/shared'
import { createPipelineService } from './pipeline-service'
import { updatePipelineSessionMeta } from './pipeline-session-manager'

describe('pipeline-service', () => {
  const originalConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
  let tempConfigDir = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-pipeline-service-'))
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

  test('收到 gate 响应后继续执行并完成', async () => {
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-1',
      sessionId: 'session-1',
      node: 'explorer',
      iteration: 0,
      createdAt: Date.now(),
    }

    const runningState: PipelineStateSnapshot = {
      sessionId: 'session-1',
      currentNode: 'explorer',
      status: 'waiting_human',
      reviewIteration: 0,
      pendingGate: gateRequest,
      updatedAt: Date.now(),
    }

    const completedState: PipelineStateSnapshot = {
      sessionId: 'session-1',
      currentNode: 'tester',
      status: 'completed',
      reviewIteration: 0,
      lastApprovedNode: 'tester',
      pendingGate: null,
      updatedAt: Date.now(),
    }

    const graphCalls: string[] = []
    const events: PipelineStreamPayload[] = []

    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return { state: runningState, interrupted: gateRequest }
        },
        resume: async (input: { sessionId: string; response: PipelineGateResponse }) => {
          graphCalls.push(`resume:${input.response.action}`)
          return { state: completedState }
        },
        getState: async () => completedState,
      }),
    })

    const session = service.createSession('测试 Pipeline', 'channel-1', 'workspace-1')
    const startPromise = service.start(
      {
        sessionId: session.id,
        userInput: '请执行 pipeline',
      },
      {
        onEvent: (payload) => events.push(payload),
      },
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(service.getPendingGates()).toHaveLength(1)

    await service.respondGate({
      gateId: 'gate-1',
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })

    await startPromise

    expect(graphCalls).toEqual(['invoke', 'resume:approve'])
    expect(events.some((payload) => payload.event.type === 'gate_waiting')).toBe(true)
    expect(events.some((payload) => payload.event.type === 'gate_resolved')).toBe(true)
    expect(service.getPendingGates()).toHaveLength(0)
    expect(service.getSessionState(session.id)).resolves.toMatchObject({
      status: 'completed',
      lastApprovedNode: 'tester',
    })
  })

  test('等待人工审核时 stop 不应继续 resume graph，并应落为 terminated', async () => {
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-stop',
      sessionId: 'session-stop',
      node: 'planner',
      iteration: 0,
      createdAt: Date.now(),
    }

    const runningState: PipelineStateSnapshot = {
      sessionId: 'session-stop',
      currentNode: 'planner',
      status: 'waiting_human',
      reviewIteration: 0,
      pendingGate: gateRequest,
      updatedAt: Date.now(),
    }

    const graphCalls: string[] = []
    const events: PipelineStreamPayload[] = []

    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return { state: runningState, interrupted: gateRequest }
        },
        resume: async () => {
          graphCalls.push('resume')
          return { state: runningState }
        },
        getState: async () => runningState,
      }),
    })

    const session = service.createSession('停止测试', 'channel-1', 'workspace-1')
    const startPromise = service.start(
      {
        sessionId: session.id,
        userInput: '请在 gate 等待时停止',
      },
      {
        onEvent: (payload) => events.push(payload),
      },
    )

    await new Promise((resolve) => setTimeout(resolve, 0))
    service.stop(session.id)
    await startPromise

    expect(graphCalls).toEqual(['invoke'])
    expect(service.listSessions().find((item) => item.id === session.id)?.status).toBe('terminated')
    expect(events.some((payload) =>
      payload.event.type === 'status_change' && payload.event.status === 'terminated')).toBe(true)
  })

  test('resume 路径失败时也应写回 node_failed 状态', async () => {
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-resume-error',
      sessionId: 'session-resume-error',
      node: 'reviewer',
      iteration: 0,
      createdAt: Date.now(),
    }

    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume exploded')
        },
        getState: async () => ({
          sessionId: 'session-resume-error',
          currentNode: 'reviewer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('恢复失败测试', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      currentNode: 'reviewer',
      status: 'waiting_human',
      pendingGate: gateRequest,
    })

    await expect(service.respondGate({
      gateId: gateRequest.gateId,
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })).rejects.toThrow('resume exploded')

    expect(service.listSessions().find((item) => item.id === session.id)?.status).toBe('node_failed')
  })

  test('置顶已归档 Pipeline 会话时自动取消归档', () => {
    const service = createPipelineService()
    const session = service.createSession('置顶归档互斥测试', 'channel-1', 'workspace-1')

    const archived = service.toggleArchive(session.id)
    expect(archived.archived).toBe(true)

    const pinned = service.togglePin(session.id)
    expect(pinned.pinned).toBe(true)
    expect(pinned.archived).toBe(false)
  })

  test('归档已置顶 Pipeline 会话时自动取消置顶', () => {
    const service = createPipelineService()
    const session = service.createSession('归档置顶互斥测试', 'channel-1', 'workspace-1')

    const pinned = service.togglePin(session.id)
    expect(pinned.pinned).toBe(true)

    const archived = service.toggleArchive(session.id)
    expect(archived.archived).toBe(true)
    expect(archived.pinned).toBe(false)
  })
})
