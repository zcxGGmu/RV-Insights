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
})
