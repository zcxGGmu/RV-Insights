import { rmSync } from 'node:fs'
import type {
  PipelineGateRequest,
  PipelineGateResponse,
  PipelineSessionMeta,
  PipelineStageArtifactRecord,
  PipelineStartInput,
  PipelineStateSnapshot,
  PipelineStreamCompletePayload,
  PipelineStreamErrorPayload,
  PipelineStreamPayload,
  PipelineStreamEvent,
} from '@rv-insights/shared'
import type { PipelineNodeRunner } from './pipeline-node-runner'
import { PipelineCheckpointer } from './pipeline-checkpointer'
import {
  appendPipelineRecord,
  createPipelineSession,
  deletePipelineSession,
  getPipelineRecords,
  getPipelineSessionMeta,
  listPipelineSessions,
  updatePipelineSessionMeta,
} from './pipeline-session-manager'
import { PipelineHumanGateService } from './pipeline-human-gate-service'
import { createPipelineGraph } from './pipeline-graph'
import { buildPipelineRecordsFromNodeComplete } from './pipeline-record-builder'
import {
  persistPipelineStageArtifactRecord,
  resolvePipelineSessionArtifactsDir,
} from './pipeline-artifact-service'

export interface PipelineServiceCallbacks {
  onEvent?: (payload: PipelineStreamPayload) => void
  onComplete?: (payload: PipelineStreamCompletePayload) => void
  onError?: (payload: PipelineStreamErrorPayload) => void
}

interface PipelineGraphController {
  invoke(input: { sessionId: string; userInput: string }): Promise<{ state: PipelineStateSnapshot; interrupted?: PipelineGateRequest }>
  resume(input: { sessionId: string; response: PipelineGateResponse }): Promise<{ state: PipelineStateSnapshot; interrupted?: PipelineGateRequest }>
  getState(sessionId: string): Promise<PipelineStateSnapshot>
}

interface CreatePipelineServiceOptions {
  createGraph?: (
    meta: PipelineSessionMeta,
    signal?: AbortSignal,
    callbacks?: PipelineServiceCallbacks,
  ) => PipelineGraphController | Promise<PipelineGraphController>
  gateService?: PipelineHumanGateService
  checkpointer?: PipelineCheckpointer
}

function isTerminalState(status: PipelineStateSnapshot['status']): boolean {
  return status === 'completed'
    || status === 'terminated'
    || status === 'recovery_failed'
}

interface PipelineStageArtifactPersistor {
  (record: PipelineStageArtifactRecord): PipelineStageArtifactRecord
}

export function appendPipelineNodeCompleteRecords(
  sessionId: string,
  event: Extract<PipelineStreamEvent, { type: 'node_complete' }>,
  persistStageArtifactRecord: PipelineStageArtifactPersistor = persistPipelineStageArtifactRecord,
): void {
  for (const record of buildPipelineRecordsFromNodeComplete(sessionId, event)) {
    if (record.type !== 'stage_artifact') {
      appendPipelineRecord(sessionId, record)
      continue
    }

    let artifactRecord = record
    try {
      artifactRecord = persistStageArtifactRecord(record)
    } catch (error) {
      console.warn('[Pipeline] 阶段产物落盘失败:', error)
    }
    appendPipelineRecord(sessionId, artifactRecord)
  }
}

export function createPipelineService(options: CreatePipelineServiceOptions = {}) {
  const gateService = options.gateService ?? new PipelineHumanGateService()
  const checkpointer = options.checkpointer ?? new PipelineCheckpointer()
  const activeControllers = new Map<string, AbortController>()
  const activeRunners = new Map<string, PipelineNodeRunner>()
  const activeCallbacks = new Map<string, PipelineServiceCallbacks | undefined>()

  function emitEvent(
    sessionId: string,
    callbacks: PipelineServiceCallbacks | undefined,
    payload: PipelineStreamPayload['event'],
  ): void {
    callbacks?.onEvent?.({
      sessionId,
      event: payload,
    })
  }

  function syncSessionState(
    sessionId: string,
    state: PipelineStateSnapshot,
    pendingGate?: PipelineGateRequest | null,
  ): PipelineSessionMeta {
    return updatePipelineSessionMeta(sessionId, {
      currentNode: state.currentNode,
      status: state.status,
      reviewIteration: state.reviewIteration,
      lastApprovedNode: state.lastApprovedNode,
      pendingGate: pendingGate ?? state.pendingGate,
    })
  }

  function appendStatusRecord(
    sessionId: string,
    status: PipelineStateSnapshot['status'],
    reason?: string,
  ): void {
    appendPipelineRecord(sessionId, {
      id: `${sessionId}-status-${status}-${Date.now()}`,
      sessionId,
      type: 'status_change',
      status,
      reason,
      createdAt: Date.now(),
    })
  }

  function emitStatusChange(
    sessionId: string,
    status: PipelineStateSnapshot['status'],
    currentNode: PipelineStateSnapshot['currentNode'],
    callbacks?: PipelineServiceCallbacks,
  ): void {
    emitEvent(sessionId, callbacks ?? activeCallbacks.get(sessionId), {
      type: 'status_change',
      status,
      currentNode,
      createdAt: Date.now(),
    })
  }

  function assertGateResponseMatchesPending(
    meta: PipelineSessionMeta,
    response: PipelineGateResponse,
  ): PipelineGateRequest | null {
    const pendingGate = meta.pendingGate
    if (!pendingGate) {
      return null
    }

    if (meta.status !== 'waiting_human') {
      throw new Error(`Pipeline gate 状态不匹配，当前状态: ${meta.status}`)
    }

    if (pendingGate.gateId !== response.gateId) {
      throw new Error('Pipeline gate 已过期或不匹配，请刷新后重试')
    }

    if (pendingGate.sessionId !== response.sessionId) {
      throw new Error('Pipeline gate 会话不匹配，请刷新后重试')
    }

    return pendingGate
  }

  async function buildDefaultGraph(
    meta: PipelineSessionMeta,
    signal?: AbortSignal,
    callbacks?: PipelineServiceCallbacks,
  ): Promise<PipelineGraphController> {
    const { ClaudePipelineNodeRunner } = await import('./pipeline-node-runner')
    const runner = new ClaudePipelineNodeRunner({
      channelId: meta.channelId,
      workspaceId: meta.workspaceId,
      onEvent: (event) => {
        if (event.type === 'node_start') {
          appendPipelineRecord(meta.id, {
            id: `${meta.id}-${event.node}-${event.createdAt}-start`,
            sessionId: meta.id,
            type: 'node_transition',
            toNode: event.node,
            createdAt: event.createdAt,
          })
        }

        if (event.type === 'node_complete') {
          appendPipelineNodeCompleteRecords(meta.id, event)
        }

        emitEvent(meta.id, callbacks, event)
      },
    })

    activeRunners.set(meta.id, runner)

    return createPipelineGraph({
      checkpointer,
      getSignal: () => signal,
      runNode: (node, context) => runner.runNode(node, context),
    })
  }

  const createGraph = options.createGraph ?? buildDefaultGraph

  async function driveResult(
    meta: PipelineSessionMeta,
    result: { state: PipelineStateSnapshot; interrupted?: PipelineGateRequest },
    callbacks?: PipelineServiceCallbacks,
  ): Promise<void> {
    let current = result

    while (true) {
      syncSessionState(meta.id, current.state, current.interrupted ?? null)

      if (!current.interrupted) {
        if (isTerminalState(current.state.status)) {
          callbacks?.onComplete?.({
            sessionId: meta.id,
            state: current.state,
          })
        }
        return
      }

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${current.interrupted.gateId}-request`,
        sessionId: meta.id,
        type: 'gate_requested',
        node: current.interrupted.node,
        gateId: current.interrupted.gateId,
        summary: current.interrupted.summary,
        createdAt: current.interrupted.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_waiting',
        request: current.interrupted,
        createdAt: Date.now(),
      })

      const controller = activeControllers.get(meta.id)
      const response = await gateService.waitForDecision(meta.id, current.interrupted, controller?.signal)
      if (controller?.signal.aborted) {
        return
      }

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${response.gateId}-response`,
        sessionId: meta.id,
        type: 'gate_decision',
        node: current.interrupted.node,
        action: response.action,
        feedback: response.feedback,
        createdAt: response.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_resolved',
        response,
        createdAt: Date.now(),
      })

      const latestMeta = getPipelineSessionMeta(meta.id)
      if (!latestMeta) return

      const graph = await Promise.resolve(createGraph(latestMeta, controller?.signal, callbacks))
      current = await graph.resume({
        sessionId: meta.id,
        response,
      })
    }
  }

  async function runExecution(
    meta: PipelineSessionMeta,
    callbacks: PipelineServiceCallbacks | undefined,
    executor: (
      graph: PipelineGraphController,
      latestMeta: PipelineSessionMeta,
      controller: AbortController,
    ) => Promise<{ state: PipelineStateSnapshot; interrupted?: PipelineGateRequest }>,
  ): Promise<void> {
    if (activeControllers.has(meta.id)) {
      throw new Error(`Pipeline 会话正在运行中: ${meta.id}`)
    }

    const controller = new AbortController()
    activeControllers.set(meta.id, controller)
    activeCallbacks.set(meta.id, callbacks)

    try {
      const latestMeta = getPipelineSessionMeta(meta.id)
      if (!latestMeta) {
        throw new Error(`未找到 Pipeline 会话: ${meta.id}`)
      }

      const graph = await Promise.resolve(createGraph(latestMeta, controller.signal, callbacks))
      const result = await executor(graph, latestMeta, controller)
      await driveResult(latestMeta, result, callbacks)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      const currentMeta = getPipelineSessionMeta(meta.id)
      if (!controller.signal.aborted) {
        appendPipelineRecord(meta.id, {
          id: `${meta.id}-error-${Date.now()}`,
          sessionId: meta.id,
          type: 'error',
          node: currentMeta?.currentNode,
          error: message,
          createdAt: Date.now(),
        })
      }

      const terminalStatus = controller.signal.aborted ? 'terminated' : 'node_failed'
      if (!controller.signal.aborted || currentMeta?.status !== 'terminated') {
        const updatedMeta = updatePipelineSessionMeta(meta.id, {
          status: terminalStatus,
          pendingGate: null,
        })
        appendStatusRecord(meta.id, terminalStatus, controller.signal.aborted ? '操作已停止' : message)
        emitStatusChange(meta.id, terminalStatus, updatedMeta.currentNode, callbacks)
      }

      if (!controller.signal.aborted) {
        callbacks?.onError?.({
          sessionId: meta.id,
          error: message,
        })
        throw error
      }
    } finally {
      activeControllers.delete(meta.id)
      activeCallbacks.delete(meta.id)
      activeRunners.delete(meta.id)
    }
  }

  return {
    listSessions(): PipelineSessionMeta[] {
      return listPipelineSessions()
    },

    createSession(
      title?: string,
      channelId?: string,
      workspaceId?: string,
    ): PipelineSessionMeta {
      return createPipelineSession(title, channelId, workspaceId)
    },

    getRecords(sessionId: string) {
      return getPipelineRecords(sessionId)
    },

    updateTitle(sessionId: string, title: string): PipelineSessionMeta {
      return updatePipelineSessionMeta(sessionId, { title })
    },

    deleteSession(sessionId: string): void {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      if (activeControllers.has(meta.id)) {
        throw new Error(`Pipeline 会话正在运行中，请先停止: ${meta.id}`)
      }

      gateService.clearSessionPending(meta.id)
      void checkpointer.deleteThread(meta.id)
      rmSync(resolvePipelineSessionArtifactsDir(meta.id, { create: false }), {
        recursive: true,
        force: true,
      })
      deletePipelineSession(meta.id)
    },

    getArtifactsDir(sessionId: string): string {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }

      return resolvePipelineSessionArtifactsDir(meta.id)
    },

    togglePin(sessionId: string): PipelineSessionMeta {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      const nextPinned = !meta.pinned
      return updatePipelineSessionMeta(sessionId, {
        pinned: nextPinned,
        ...(nextPinned && meta.archived ? { archived: false } : {}),
      })
    },

    toggleArchive(sessionId: string): PipelineSessionMeta {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      const nextArchived = !meta.archived
      return updatePipelineSessionMeta(sessionId, {
        archived: nextArchived,
        ...(nextArchived && meta.pinned ? { pinned: false } : {}),
      })
    },

    async start(
      input: PipelineStartInput,
      callbacks?: PipelineServiceCallbacks,
    ): Promise<void> {
      const meta = getPipelineSessionMeta(input.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${input.sessionId}`)
      }

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-user-${Date.now()}`,
        sessionId: meta.id,
        type: 'user_input',
        content: input.userInput,
        createdAt: Date.now(),
      })

      updatePipelineSessionMeta(meta.id, {
        channelId: input.channelId ?? meta.channelId,
        workspaceId: input.workspaceId ?? meta.workspaceId,
        threadId: input.threadId ?? meta.threadId,
        status: 'running',
        pendingGate: null,
      })
      await runExecution(meta, callbacks, async (graph) => graph.invoke({
        sessionId: meta.id,
        userInput: input.userInput,
      }))
    },

    async respondGate(
      response: PipelineGateResponse,
      callbacks?: PipelineServiceCallbacks,
    ): Promise<void> {
      const hitPending = gateService.respond(response)
      if (hitPending) return

      const meta = getPipelineSessionMeta(response.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${response.sessionId}`)
      }
      const pendingGate = assertGateResponseMatchesPending(meta, response)
      if (!pendingGate) {
        return
      }
      if (activeControllers.has(meta.id)) {
        return
      }

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${response.gateId}-response`,
        sessionId: meta.id,
        type: 'gate_decision',
        node: pendingGate.node,
        action: response.action,
        feedback: response.feedback,
        createdAt: response.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_resolved',
        response,
        createdAt: Date.now(),
      })
      await runExecution(meta, callbacks, async (graph) => graph.resume({
        sessionId: meta.id,
        response,
      }))
    },

    async resume(
      input: { sessionId: string; response?: PipelineGateResponse },
      callbacks?: PipelineServiceCallbacks,
    ): Promise<void> {
      if (!input.response) {
        throw new Error('resumePipeline 需要提供 gate response')
      }
      await this.respondGate(input.response, callbacks)
    },

    stop(sessionId: string): void {
      const meta = getPipelineSessionMeta(sessionId)
      activeControllers.get(sessionId)?.abort()
      activeRunners.get(sessionId)?.abort?.(sessionId)
      const updatedMeta = updatePipelineSessionMeta(sessionId, {
        status: 'terminated',
        pendingGate: null,
      })
      appendStatusRecord(sessionId, 'terminated', '操作已停止')
      emitStatusChange(sessionId, 'terminated', updatedMeta.currentNode)
      if (meta?.pendingGate) {
        gateService.clearSessionPending(sessionId)
      }
    },

    getPendingGates(): PipelineGateRequest[] {
      const combined = new Map<string, PipelineGateRequest>()

      for (const request of gateService.getPendingRequests()) {
        combined.set(request.gateId, request)
      }

      for (const session of listPipelineSessions()) {
        if (session.pendingGate) {
          combined.set(session.pendingGate.gateId, session.pendingGate)
        }
      }

      return [...combined.values()]
    },

    async getSessionState(sessionId: string): Promise<PipelineStateSnapshot> {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }

      try {
        const graph = await Promise.resolve(createGraph(meta))
        return await graph.getState(sessionId)
      } catch {
        return {
          sessionId: meta.id,
          currentNode: meta.currentNode,
          status: meta.status,
          reviewIteration: meta.reviewIteration,
          lastApprovedNode: meta.lastApprovedNode,
          pendingGate: meta.pendingGate,
          updatedAt: meta.updatedAt,
        }
      }
    },
  }
}

let pipelineServiceSingleton: ReturnType<typeof createPipelineService> | null = null

export function getPipelineService() {
  if (!pipelineServiceSingleton) {
    pipelineServiceSingleton = createPipelineService()
  }
  return pipelineServiceSingleton
}
