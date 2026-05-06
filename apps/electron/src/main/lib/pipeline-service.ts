import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type {
  PipelineGateRequest,
  PipelineGateResponse,
  PipelineSessionMeta,
  PipelineStartInput,
  PipelineStateSnapshot,
  PipelineStreamCompletePayload,
  PipelineStreamErrorPayload,
  PipelineStreamPayload,
} from '@rv-insights/shared'
import type { PipelineNodeRunner } from './pipeline-node-runner'
import { PipelineCheckpointer } from './pipeline-checkpointer'
import { getPipelineArtifactsDir } from './config-paths'
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

export function createPipelineService(options: CreatePipelineServiceOptions = {}) {
  const gateService = options.gateService ?? new PipelineHumanGateService()
  const checkpointer = options.checkpointer ?? new PipelineCheckpointer()
  const activeControllers = new Map<string, AbortController>()
  const activeRunners = new Map<string, PipelineNodeRunner>()

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
          appendPipelineRecord(meta.id, {
            id: `${meta.id}-${event.node}-${event.createdAt}-output`,
            sessionId: meta.id,
            type: 'node_output',
            node: event.node,
            content: event.output,
            summary: event.summary,
            createdAt: event.createdAt,
          })
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
      gateService.clearSessionPending(sessionId)
      void checkpointer.deleteThread(sessionId)
      rmSync(join(getPipelineArtifactsDir(), sessionId), {
        recursive: true,
        force: true,
      })
      deletePipelineSession(sessionId)
    },

    togglePin(sessionId: string): PipelineSessionMeta {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      return updatePipelineSessionMeta(sessionId, { pinned: !meta.pinned })
    },

    toggleArchive(sessionId: string): PipelineSessionMeta {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }
      return updatePipelineSessionMeta(sessionId, { archived: !meta.archived })
    },

    async start(
      input: PipelineStartInput,
      callbacks?: PipelineServiceCallbacks,
    ): Promise<void> {
      const meta = getPipelineSessionMeta(input.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${input.sessionId}`)
      }

      if (activeControllers.has(meta.id)) {
        throw new Error(`Pipeline 会话正在运行中: ${meta.id}`)
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

      const controller = new AbortController()
      activeControllers.set(meta.id, controller)

      try {
        const latestMeta = getPipelineSessionMeta(meta.id)
        if (!latestMeta) {
          throw new Error(`未找到 Pipeline 会话: ${meta.id}`)
        }

        const graph = await Promise.resolve(createGraph(latestMeta, controller.signal, callbacks))
        const result = await graph.invoke({
          sessionId: meta.id,
          userInput: input.userInput,
        })
        await driveResult(latestMeta, result, callbacks)
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        appendPipelineRecord(meta.id, {
          id: `${meta.id}-error-${Date.now()}`,
          sessionId: meta.id,
          type: 'error',
          node: getPipelineSessionMeta(meta.id)?.currentNode,
          error: message,
          createdAt: Date.now(),
        })
        updatePipelineSessionMeta(meta.id, {
          status: controller.signal.aborted ? 'terminated' : 'node_failed',
          pendingGate: null,
        })
        callbacks?.onError?.({
          sessionId: meta.id,
          error: message,
        })
        if (!controller.signal.aborted) {
          throw error
        }
      } finally {
        activeControllers.delete(meta.id)
        activeRunners.delete(meta.id)
      }
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

      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${response.gateId}-response`,
        sessionId: meta.id,
        type: 'gate_decision',
        node: meta.pendingGate?.node ?? meta.currentNode,
        action: response.action,
        feedback: response.feedback,
        createdAt: response.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_resolved',
        response,
        createdAt: Date.now(),
      })

      const graph = await Promise.resolve(createGraph(meta, undefined, callbacks))
      const result = await graph.resume({
        sessionId: meta.id,
        response,
      })
      await driveResult(meta, result, callbacks)
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
      activeControllers.get(sessionId)?.abort()
      activeRunners.get(sessionId)?.abort?.(sessionId)
      updatePipelineSessionMeta(sessionId, {
        status: 'terminated',
        pendingGate: null,
      })
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
