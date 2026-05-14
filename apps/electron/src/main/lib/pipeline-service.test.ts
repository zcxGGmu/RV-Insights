import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type {
  PipelineGateRequest,
  PipelineGateResponse,
  PipelineStateSnapshot,
  PipelineStreamPayload,
} from '@rv-insights/shared'
import {
  appendPipelineNodeCompleteRecords,
  createPipelineService,
} from './pipeline-service'
import { getPipelineRecords, updatePipelineSessionMeta } from './pipeline-session-manager'
import { resolvePipelineSessionArtifactsDir } from './pipeline-artifact-service'
import { getPipelineSessionCheckpointDir } from './config-paths'
import {
  createContributionTask,
  getContributionTask,
  getContributionTaskByPipelineSessionId,
} from './contribution-task-service'
import {
  readPatchWorkManifest,
  writePatchWorkFile,
} from './pipeline-patch-work-service'
import { createAgentWorkspace } from './agent-workspace-manager'

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
      kind: 'task_selection',
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
      kind: 'task_selection',
      action: 'approve',
      selectedReportId: 'report-1',
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
    expect(getPipelineRecords(session.id).find((record) => record.type === 'gate_decision')).toMatchObject({
      type: 'gate_decision',
      kind: 'task_selection',
      selectedReportId: 'report-1',
    })
  })

  test('启动 v2 会话前会创建 ContributionTask 和 patch-work manifest', async () => {
    const workspace = createAgentWorkspace('贡献工作区')
    const service = createPipelineService({
      createGraph: (meta) => ({
        invoke: async () => ({
          state: {
            sessionId: meta.id,
            version: 2,
            currentNode: 'committer',
            status: 'completed',
            reviewIteration: 0,
            lastApprovedNode: 'committer',
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => ({
          sessionId: meta.id,
          version: 2,
          currentNode: 'committer',
          status: 'completed',
          reviewIteration: 0,
          lastApprovedNode: 'committer',
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('贡献 Pipeline', 'channel-1', workspace.id, 2)
    await service.start({
      sessionId: session.id,
      userInput: '请执行 v2 贡献流程',
      channelId: 'channel-1',
      workspaceId: workspace.id,
    })

    const task = getContributionTaskByPipelineSessionId(session.id)
    expect(task).toMatchObject({
      pipelineSessionId: session.id,
      workspaceId: workspace.id,
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'exploring',
    })
    expect(readPatchWorkManifest(task!.repositoryRoot)).toMatchObject({
      contributionTaskId: task!.id,
      pipelineSessionId: session.id,
    })
  })

  test('task_selection gate 必须选择 report，并写回 selected-task.md 和 ContributionTask', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-pipeline-service-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-task-selection',
      sessionId: 'session-task-selection',
      node: 'explorer',
      kind: 'task_selection',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-task-selection',
            version: 2,
            currentNode: 'planner',
            status: 'waiting_human',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-task-selection',
          version: 2,
          currentNode: 'explorer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('任务选择测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'explorer',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-selection',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'exploring',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-selection',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'explorer_report',
        relativePath: 'explorer/report-001.md',
        createdByNode: 'explorer',
        content: '# 探索报告：任务选择闭环\n\n## 贡献点概述\n选择后才能进入 planner。\n',
      })

      await expect(service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'task_selection',
        action: 'approve',
        createdAt: Date.now(),
      })).rejects.toThrow('请选择 explorer report')

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'task_selection',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      })

      expect(getContributionTask('task-selection')).toMatchObject({
        selectedReportId: 'report-001',
        selectedTaskTitle: '任务选择闭环',
        status: 'task_selected',
      })
      expect(readPatchWorkManifest(repoRoot)).toMatchObject({
        selectedReportId: 'report-001',
      })
      expect(readFileSync(join(repoRoot, 'patch-work', 'selected-task.md'), 'utf-8')).toContain('任务选择闭环')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('planner document_review approve 会记录 plan.md 和 test-plan.md 的 accepted checksum', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-pipeline-service-plan-repo-'))
    const gateRequest: PipelineGateRequest = {
      gateId: 'gate-plan-review',
      sessionId: 'session-plan-review',
      node: 'planner',
      kind: 'document_review',
      iteration: 0,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => ({
          state: {
            sessionId: 'session-plan-review',
            version: 2,
            currentNode: 'developer',
            status: 'running',
            reviewIteration: 0,
            pendingGate: null,
            updatedAt: Date.now(),
          },
        }),
        getState: async () => ({
          sessionId: 'session-plan-review',
          version: 2,
          currentNode: 'planner',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    try {
      const session = service.createSession('文档审核测试', 'channel-1', 'workspace-1')
      updatePipelineSessionMeta(session.id, {
        version: 2,
        currentNode: 'planner',
        status: 'waiting_human',
        pendingGate: {
          ...gateRequest,
          sessionId: session.id,
        },
      })
      createContributionTask({
        id: 'task-plan-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'plan_review',
      })
      const planRef = writePatchWorkFile({
        contributionTaskId: 'task-plan-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n\n实现任务选择。\n',
      })
      const testPlanRef = writePatchWorkFile({
        contributionTaskId: 'task-plan-review',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'test_plan',
        createdByNode: 'planner',
        content: '# 测试方案\n\n验证任务选择。\n',
      })

      await service.respondGate({
        gateId: gateRequest.gateId,
        sessionId: session.id,
        kind: 'document_review',
        action: 'approve',
        createdAt: Date.now(),
      })

      const manifest = readPatchWorkManifest(repoRoot)
      expect(manifest.files.find((file) => file.relativePath === 'plan.md')).toMatchObject({
        acceptedRevision: planRef.revision,
        acceptedByGateId: gateRequest.gateId,
        checksum: planRef.checksum,
      })
      expect(manifest.files.find((file) => file.relativePath === 'test-plan.md')).toMatchObject({
        acceptedRevision: testPlanRef.revision,
        acceptedByGateId: gateRequest.gateId,
        checksum: testPlanRef.checksum,
      })
      expect(getContributionTask('task-plan-review')).toMatchObject({
        status: 'developing',
      })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('patch-work 文件读取只允许 manifest 登记文件', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'rv-pipeline-service-read-repo-'))
    const service = createPipelineService()

    try {
      const session = service.createSession('patch-work 读取范围测试', 'channel-1', 'workspace-1')
      createContributionTask({
        id: 'task-read-range',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        patchWorkDir: join(repoRoot, 'patch-work'),
        contributionMode: 'local_patch',
        allowRemoteWrites: false,
        status: 'plan_review',
      })
      writePatchWorkFile({
        contributionTaskId: 'task-read-range',
        pipelineSessionId: session.id,
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: '# 开发方案\n',
      })
      writeFileSync(join(repoRoot, 'patch-work', 'untracked.md'), '# 未登记文件\n', 'utf-8')

      expect(service.readPatchWorkFile({
        sessionId: session.id,
        relativePath: 'plan.md',
      })).toContain('开发方案')
      expect(() => service.readPatchWorkFile({
        sessionId: session.id,
        relativePath: 'untracked.md',
      })).toThrow('未登记')
      expect(() => service.readPatchWorkFile({
        sessionId: session.id,
        relativePath: 'manifest.json',
      })).toThrow('未登记')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('内存 gate 已消费但 resume 未结束时，重复响应不应写入重复 gate decision', async () => {
    let sessionId = ''
    let gateRequest: PipelineGateRequest = {
      gateId: 'gate-race',
      sessionId,
      node: 'reviewer',
      iteration: 0,
      createdAt: Date.now(),
    }
    let markResumeStarted: () => void = () => undefined
    let finishResume: () => void = () => undefined
    const resumeStarted = new Promise<void>((resolve) => {
      markResumeStarted = resolve
    })
    const graphCalls: string[] = []
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return {
            state: {
              sessionId,
              currentNode: 'reviewer',
              status: 'waiting_human',
              reviewIteration: 0,
              pendingGate: gateRequest,
              updatedAt: Date.now(),
            },
            interrupted: gateRequest,
          }
        },
        resume: async () => {
          graphCalls.push('resume')
          markResumeStarted()
          return new Promise<{ state: PipelineStateSnapshot }>((resolve) => {
            finishResume = () => resolve({
              state: {
                sessionId,
                currentNode: 'tester',
                status: 'completed',
                reviewIteration: 0,
                lastApprovedNode: 'tester',
                pendingGate: null,
                updatedAt: Date.now(),
              },
            })
          })
        },
        getState: async () => ({
          sessionId,
          currentNode: 'reviewer',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate: gateRequest,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('gate 竞态测试', 'channel-1', 'workspace-1')
    sessionId = session.id
    gateRequest = {
      ...gateRequest,
      sessionId,
    }
    const response: PipelineGateResponse = {
      gateId: gateRequest.gateId,
      sessionId,
      action: 'approve',
      createdAt: Date.now(),
    }
    const startPromise = service.start({
      sessionId,
      userInput: '触发人工审核',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    await service.respondGate(response)
    await resumeStarted

    expect(getPipelineRecords(sessionId).filter((record) => record.type === 'gate_decision')).toHaveLength(1)
    await service.respondGate({
      ...response,
      createdAt: Date.now(),
    })
    expect(getPipelineRecords(sessionId).filter((record) => record.type === 'gate_decision')).toHaveLength(1)

    finishResume()
    await startPromise
    expect(graphCalls).toEqual(['invoke', 'resume'])
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
    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).toBe('terminated')
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
      pendingGate: {
        ...gateRequest,
        sessionId: session.id,
      },
    })

    await expect(service.respondGate({
      gateId: gateRequest.gateId,
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })).rejects.toThrow('resume exploded')

    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).toBe('node_failed')
  })

  test('陈旧 gate 响应不应恢复 graph 或写入 gate decision', async () => {
    const pendingGate: PipelineGateRequest = {
      gateId: 'gate-current',
      sessionId: 'session-stale-gate',
      node: 'planner',
      iteration: 0,
      createdAt: Date.now(),
    }
    const graphCalls: string[] = []
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return {
            state: {
              sessionId: 'session-stale-gate',
              currentNode: 'planner',
              status: 'waiting_human',
              reviewIteration: 0,
              pendingGate,
              updatedAt: Date.now(),
            },
            interrupted: pendingGate,
          }
        },
        resume: async () => {
          graphCalls.push('resume')
          return {
            state: {
              sessionId: 'session-stale-gate',
              currentNode: 'tester',
              status: 'completed',
              reviewIteration: 0,
              pendingGate: null,
              updatedAt: Date.now(),
            },
          }
        },
        getState: async () => ({
          sessionId: 'session-stale-gate',
          currentNode: 'planner',
          status: 'waiting_human',
          reviewIteration: 0,
          pendingGate,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('陈旧 gate 测试', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      currentNode: 'planner',
      status: 'waiting_human',
      pendingGate: {
        ...pendingGate,
        sessionId: session.id,
      },
    })

    await expect(service.respondGate({
      gateId: 'gate-stale',
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })).rejects.toThrow('Pipeline gate 已过期')

    expect(graphCalls).toEqual([])
    expect(getPipelineRecords(session.id).filter((record) => record.type === 'gate_decision')).toHaveLength(0)
    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).toBe('waiting_human')
  })

  test('没有 pending gate 的重复响应应安全忽略，不应恢复 graph', async () => {
    const graphCalls: string[] = []
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          graphCalls.push('invoke')
          return {
            state: {
              sessionId: 'session-duplicate-gate',
              currentNode: 'tester',
              status: 'completed',
              reviewIteration: 0,
              pendingGate: null,
              updatedAt: Date.now(),
            },
          }
        },
        resume: async () => {
          graphCalls.push('resume')
          return {
            state: {
              sessionId: 'session-duplicate-gate',
              currentNode: 'tester',
              status: 'completed',
              reviewIteration: 0,
              pendingGate: null,
              updatedAt: Date.now(),
            },
          }
        },
        getState: async () => ({
          sessionId: 'session-duplicate-gate',
          currentNode: 'tester',
          status: 'completed',
          reviewIteration: 0,
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('重复 gate 响应测试', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      currentNode: 'tester',
      status: 'completed',
      pendingGate: null,
    })

    await service.respondGate({
      gateId: 'gate-already-done',
      sessionId: session.id,
      action: 'approve',
      createdAt: Date.now(),
    })

    expect(graphCalls).toEqual([])
    expect(getPipelineRecords(session.id).filter((record) => record.type === 'gate_decision')).toHaveLength(0)
  })

  test('运行中的 Pipeline 会话不能直接删除', async () => {
    const invokeController: {
      resolve?: (value: { state: PipelineStateSnapshot }) => void
    } = {}
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => new Promise<{ state: PipelineStateSnapshot }>((resolve) => {
          invokeController.resolve = resolve
        }),
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => ({
          sessionId: 'session-active-delete',
          currentNode: 'developer',
          status: 'running',
          reviewIteration: 0,
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })

    const session = service.createSession('运行中删除保护测试', 'channel-1', 'workspace-1')
    const startPromise = service.start({
      sessionId: session.id,
      userInput: '保持运行',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(() => service.deleteSession(session.id)).toThrow('Pipeline 会话正在运行中')
    expect((await service.listSessions()).some((item) => item.id === session.id)).toBe(true)

    invokeController.resolve?.({
      state: {
        sessionId: session.id,
        currentNode: 'tester',
        status: 'completed',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: Date.now(),
      },
    })
    await startPromise
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

  test('删除 Pipeline 会话前会校验真实 session，避免产物目录越界删除', () => {
    const service = createPipelineService()
    const outsideDir = join(tempConfigDir, 'outside')
    mkdirSync(outsideDir, { recursive: true })
    writeFileSync(join(outsideDir, 'keep.txt'), '不能被删除', 'utf-8')

    expect(() => service.deleteSession('../outside')).toThrow('未找到 Pipeline 会话')
    expect(existsSync(join(outsideDir, 'keep.txt'))).toBe(true)
  })

  test('删除真实 Pipeline 会话时会清理对应产物目录', () => {
    const service = createPipelineService()
    const session = service.createSession('删除产物测试', 'channel-1', 'workspace-1')
    const artifactsDir = resolvePipelineSessionArtifactsDir(session.id)
    writeFileSync(join(artifactsDir, 'artifact.md'), '# 产物', 'utf-8')

    service.deleteSession(session.id)

    expect(existsSync(artifactsDir)).toBe(false)
  })

  test('阶段产物落盘失败不应阻断 node_complete 记录追加', async () => {
    const service = createPipelineService()
    const session = service.createSession('落盘失败降级测试', 'channel-1', 'workspace-1')
    const originalWarn = console.warn
    console.warn = () => undefined

    try {
      appendPipelineNodeCompleteRecords(
        session.id,
        {
          type: 'node_complete',
          node: 'planner',
          output: '计划完成',
          summary: '按两步实现',
          artifact: {
            node: 'planner',
            summary: '按两步实现',
            steps: ['补测试', '改实现'],
            risks: [],
            verification: ['bun test'],
            content: '计划完成',
          },
          createdAt: 300,
        },
        () => {
          throw new Error('disk full')
        },
      )
    } finally {
      console.warn = originalWarn
    }

    const records = getPipelineRecords(session.id)
    const stageRecord = records[1]
    expect(records.map((record) => record.type)).toEqual(['node_output', 'stage_artifact'])
    expect(stageRecord).toMatchObject({
      type: 'stage_artifact',
      node: 'planner',
    })
    if (stageRecord?.type !== 'stage_artifact') {
      throw new Error('未找到阶段产物记录')
    }
    expect(stageRecord.artifactFiles).toBeUndefined()
    expect((await service.listSessions()).find((item) => item.id === session.id)?.status).not.toBe('node_failed')
  })

  test('listSessions 会将无 active runner 的遗留 running 会话降级为 recovery_failed', async () => {
    const service = createPipelineService()
    const session = service.createSession('遗留运行会话', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'running',
      currentNode: 'developer',
      pendingGate: null,
    })

    const sessions = await service.listSessions()
    const reconciled = sessions.find((item) => item.id === session.id)
    const statusRecords = getPipelineRecords(session.id).filter((record) => record.type === 'status_change')

    expect(reconciled).toMatchObject({
      status: 'recovery_failed',
      pendingGate: null,
    })
    expect(statusRecords.at(-1)).toMatchObject({
      type: 'status_change',
      status: 'recovery_failed',
    })
  })

  test('listSessions 会从 checkpoint 快照回填 waiting_human 的 pending gate', async () => {
    const pendingGate: PipelineGateRequest = {
      gateId: 'gate-recovered',
      sessionId: 'session-from-checkpoint',
      node: 'planner',
      iteration: 2,
      createdAt: Date.now(),
    }
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async (sessionId: string) => ({
          sessionId,
          currentNode: 'planner',
          status: 'waiting_human',
          reviewIteration: 2,
          pendingGate: {
            ...pendingGate,
            sessionId,
          },
          updatedAt: Date.now(),
        }),
      }),
    })
    const session = service.createSession('恢复审核会话', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'planner',
      reviewIteration: 0,
      pendingGate: null,
    })

    const sessions = await service.listSessions()
    const reconciled = sessions.find((item) => item.id === session.id)

    expect(reconciled).toMatchObject({
      status: 'waiting_human',
      currentNode: 'planner',
      reviewIteration: 2,
    })
    expect(reconciled?.pendingGate).toMatchObject({
      gateId: 'gate-recovered',
      sessionId: session.id,
      node: 'planner',
    })
    expect(service.getPendingGates()).toContainEqual(expect.objectContaining({
      gateId: 'gate-recovered',
      sessionId: session.id,
    }))
  })

  test('listSessions 不应使用旧 meta pendingGate 覆盖已完成 checkpoint', async () => {
    const service = createPipelineService({
      createGraph: (meta) => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => ({
          sessionId: meta.id,
          currentNode: 'tester',
          status: 'completed',
          reviewIteration: 0,
          lastApprovedNode: 'tester',
          pendingGate: null,
          updatedAt: Date.now(),
        }),
      }),
    })
    const session = service.createSession('旧 gate 不应复活', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'reviewer',
      pendingGate: {
        gateId: 'gate-stale-meta',
        sessionId: session.id,
        node: 'reviewer',
        iteration: 0,
        createdAt: Date.now(),
      },
    })

    const sessions = await service.listSessions()
    const reconciled = sessions.find((item) => item.id === session.id)

    expect(reconciled).toMatchObject({
      status: 'completed',
      currentNode: 'tester',
      pendingGate: null,
      lastApprovedNode: 'tester',
    })
    expect(service.getPendingGates()).not.toContainEqual(expect.objectContaining({
      gateId: 'gate-stale-meta',
    }))
  })

  test('listSessions 读取 checkpoint 失败时不应信任 meta pendingGate', async () => {
    const service = createPipelineService({
      createGraph: () => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => {
          throw new Error('checkpoint missing')
        },
      }),
    })
    const session = service.createSession('旧 gate 但 checkpoint 丢失', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'planner',
      pendingGate: {
        gateId: 'gate-stale-without-checkpoint',
        sessionId: session.id,
        node: 'planner',
        iteration: 0,
        createdAt: Date.now(),
      },
    })

    const sessions = await service.listSessions()

    expect(sessions.find((item) => item.id === session.id)).toMatchObject({
      status: 'recovery_failed',
      pendingGate: null,
    })
    expect(service.getPendingGates()).not.toContainEqual(expect.objectContaining({
      gateId: 'gate-stale-without-checkpoint',
    }))
  })

  test('listSessions 遇到不可恢复 checkpoint 时只降级对应会话', async () => {
    const service = createPipelineService({
      createGraph: (meta) => ({
        invoke: async () => {
          throw new Error('invoke 不应被调用')
        },
        resume: async () => {
          throw new Error('resume 不应被调用')
        },
        getState: async () => {
          if (meta.title === '损坏 checkpoint') {
            throw new Error('checkpoint corrupted')
          }
          return {
            sessionId: meta.id,
            currentNode: 'reviewer',
            status: 'waiting_human',
            reviewIteration: 1,
            pendingGate: {
              gateId: 'gate-ok',
              sessionId: meta.id,
              node: 'reviewer',
              iteration: 1,
              createdAt: Date.now(),
            },
            updatedAt: Date.now(),
          }
        },
      }),
    })
    const corrupted = service.createSession('损坏 checkpoint', 'channel-1', 'workspace-1')
    const healthy = service.createSession('健康 checkpoint', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(corrupted.id, {
      status: 'waiting_human',
      currentNode: 'developer',
      pendingGate: null,
    })
    updatePipelineSessionMeta(healthy.id, {
      status: 'waiting_human',
      currentNode: 'reviewer',
      pendingGate: null,
    })

    const sessions = await service.listSessions()

    expect(sessions.find((item) => item.id === corrupted.id)).toMatchObject({
      status: 'recovery_failed',
      pendingGate: null,
    })
    expect(sessions.find((item) => item.id === healthy.id)).toMatchObject({
      status: 'waiting_human',
      pendingGate: expect.objectContaining({ gateId: 'gate-ok' }),
    })
  })

  test('listSessions 遇到损坏 checkpoint 文件时降级为 recovery_failed', async () => {
    const setupService = createPipelineService()
    const session = setupService.createSession('损坏文件 checkpoint', 'channel-1', 'workspace-1')
    updatePipelineSessionMeta(session.id, {
      status: 'waiting_human',
      currentNode: 'reviewer',
      pendingGate: {
        gateId: 'gate-corrupted-file',
        sessionId: session.id,
        node: 'reviewer',
        iteration: 0,
        createdAt: Date.now(),
      },
    })
    const checkpointDir = getPipelineSessionCheckpointDir(session.id)
    mkdirSync(checkpointDir, { recursive: true })
    writeFileSync(join(checkpointDir, 'memory-saver.json'), '{broken', 'utf-8')

    const originalWarn = console.warn
    console.warn = () => undefined
    try {
      const service = createPipelineService()
      const sessions = await service.listSessions()
      expect(sessions.find((item) => item.id === session.id)).toMatchObject({
        status: 'recovery_failed',
        pendingGate: null,
      })
    } finally {
      console.warn = originalWarn
    }
  })
})
