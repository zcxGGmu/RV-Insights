import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type {
  PipelineArtifactContentInput,
  PipelineExplorerReportRef,
  PipelineGateRequest,
  PipelineGateResponse,
  PipelinePatchWorkReadFileInput,
  PipelinePatchWorkSessionInput,
  PipelineRecordsTailInput,
  PipelineRecordsTailResult,
  PipelineRecordsSearchInput,
  PipelineRecordsSearchResult,
  PipelineSelectTaskInput,
  PipelineSelectTaskResult,
  PipelineSessionMeta,
  PipelineStageArtifactRecord,
  PipelineStartInput,
  PipelineStateSnapshot,
  PipelineVersion,
  PipelineStreamCompletePayload,
  PipelineStreamErrorPayload,
  PipelineStreamPayload,
  PipelineStreamEvent,
  PipelineGateKind,
  PipelineTestEvidence,
} from '@rv-insights/shared'
import type { PipelineNodeRunner } from './pipeline-node-runner'
import { PipelineCheckpointer } from './pipeline-checkpointer'
import {
  appendPipelineRecord,
  createPipelineSession,
  deletePipelineSession,
  getPipelineRecords,
  getPipelineRecordsTail,
  getPipelineSessionMeta,
  listPipelineSessions,
  searchPipelineRecordsPage,
  updatePipelineSessionMeta,
} from './pipeline-session-manager'
import { PipelineHumanGateService } from './pipeline-human-gate-service'
import { createPipelineGraph, createPipelineGraphV2 } from './pipeline-graph'
import { buildPipelineRecordsFromNodeComplete } from './pipeline-record-builder'
import {
  persistPipelineStageArtifactRecord,
  readPipelineArtifactContent,
  resolvePipelineSessionArtifactsDir,
} from './pipeline-artifact-service'
import { getSettings } from './settings-service'
import { resolvePipelineCodexChannelId } from './pipeline-codex-settings'
import {
  appendContributionTaskEvent,
  createContributionTask,
  getContributionTaskByPipelineSessionId,
  updateContributionTask,
} from './contribution-task-service'
import {
  acceptPatchWorkDocuments,
  initializePatchWork,
  listPatchWorkExplorerReports,
  readPatchWorkManifestFile,
  readPatchWorkManifest,
  selectPatchWorkTask,
} from './pipeline-patch-work-service'
import { getAgentWorkspace } from './agent-workspace-manager'
import { getAgentSessionWorkspacePath } from './config-paths'

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
    mode?: 'execute' | 'read',
  ) => PipelineGraphController | Promise<PipelineGraphController>
  gateService?: PipelineHumanGateService
  checkpointer?: PipelineCheckpointer
}

function isTerminalState(status: PipelineStateSnapshot['status']): boolean {
  return status === 'completed'
    || status === 'terminated'
    || status === 'recovery_failed'
}

function isReconcileCandidate(status: PipelineSessionMeta['status']): boolean {
  return status === 'running' || status === 'waiting_human'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Pipeline IPC 参数无效: ${fieldName}`)
  }
  return value.trim()
}

function parsePatchWorkSessionInput(input: PipelinePatchWorkSessionInput): PipelinePatchWorkSessionInput {
  const value = input as unknown
  if (!isObject(value)) {
    throw new Error('Pipeline IPC 参数无效: input')
  }
  return {
    sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
  }
}

function parsePatchWorkReadFileInput(input: PipelinePatchWorkReadFileInput): PipelinePatchWorkReadFileInput {
  const value = input as unknown
  if (!isObject(value)) {
    throw new Error('Pipeline IPC 参数无效: input')
  }
  return {
    sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
    relativePath: requireNonEmptyString(value.relativePath, 'relativePath'),
  }
}

function parseSelectTaskInput(input: PipelineSelectTaskInput): PipelineSelectTaskInput {
  const value = input as unknown
  if (!isObject(value)) {
    throw new Error('Pipeline IPC 参数无效: input')
  }
  return {
    sessionId: requireNonEmptyString(value.sessionId, 'sessionId'),
    gateId: requireNonEmptyString(value.gateId, 'gateId'),
    selectedReportId: requireNonEmptyString(value.selectedReportId, 'selectedReportId'),
  }
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
  let reconcileSessionsPromise: Promise<PipelineSessionMeta[]> | null = null

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

  function markRecoveryFailed(
    meta: PipelineSessionMeta,
    reason: string,
  ): PipelineSessionMeta {
    const latestMeta = getPipelineSessionMeta(meta.id) ?? meta
    if (latestMeta.status === 'recovery_failed') {
      return latestMeta
    }

    const updatedMeta = updatePipelineSessionMeta(meta.id, {
      status: 'recovery_failed',
      pendingGate: null,
    })
    appendStatusRecord(meta.id, 'recovery_failed', reason)
    return updatedMeta
  }

  async function reconcileWaitingHumanSession(
    meta: PipelineSessionMeta,
  ): Promise<PipelineSessionMeta> {
    if (checkpointer.hasCorruptedThread(meta.id)) {
      return markRecoveryFailed(meta, 'checkpoint 损坏，无法恢复 Pipeline')
    }

    try {
      const graph = await Promise.resolve(createGraph(meta))
      const snapshot = await graph.getState(meta.id)

      if (snapshot.status === 'waiting_human' && snapshot.pendingGate) {
        return updatePipelineSessionMeta(meta.id, {
          currentNode: snapshot.pendingGate.node,
          status: 'waiting_human',
          reviewIteration: snapshot.reviewIteration,
          lastApprovedNode: snapshot.lastApprovedNode,
          pendingGate: snapshot.pendingGate,
        })
      }

      if (snapshot.status === 'running') {
        return markRecoveryFailed(meta, 'checkpoint 未处于待审核状态，无法恢复运行中节点')
      }

      return updatePipelineSessionMeta(meta.id, {
        currentNode: snapshot.currentNode,
        status: snapshot.status,
        reviewIteration: snapshot.reviewIteration,
        lastApprovedNode: snapshot.lastApprovedNode,
        pendingGate: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知 checkpoint 错误'
      return markRecoveryFailed(meta, `checkpoint 恢复失败: ${message}`)
    }
  }

  async function reconcileSession(meta: PipelineSessionMeta): Promise<PipelineSessionMeta> {
    if (!isReconcileCandidate(meta.status) || activeControllers.has(meta.id)) {
      return meta
    }

    if (meta.status === 'running') {
      return markRecoveryFailed(meta, '应用重启后无法恢复运行中节点')
    }

    return reconcileWaitingHumanSession(meta)
  }

  async function reconcileSessions(): Promise<PipelineSessionMeta[]> {
    if (reconcileSessionsPromise) {
      return reconcileSessionsPromise
    }

    reconcileSessionsPromise = (async () => {
      for (const session of listPipelineSessions()) {
        await reconcileSession(session)
      }

      return listPipelineSessions()
    })().finally(() => {
      reconcileSessionsPromise = null
    })

    return reconcileSessionsPromise
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

  function getContributionTaskForSession(
    sessionId: string,
    options: { required?: boolean } = {},
  ) {
    const task = getContributionTaskByPipelineSessionId(sessionId)
    if (!task && options.required) {
      throw new Error(`未找到 Pipeline 贡献任务: ${sessionId}`)
    }
    return task
  }

  function patchTextContainsPatchWorkFile(patch: string): boolean {
    return patch.split('\n').some((line) =>
      line.startsWith('diff --git a/patch-work ')
      || line.startsWith('diff --git a/patch-work/')
      || line.includes(' b/patch-work/')
      || line.endsWith(' b/patch-work'))
  }

  function parsePatchSetChangedFilePaths(content: string): string[] {
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error('patch-set changed-files.json 不是合法数组')
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`patch-set changed-files.json 包含非法对象: ${index}`)
      }
      const path = (item as { path?: unknown }).path
      if (typeof path !== 'string' || !path.trim()) {
        throw new Error(`patch-set changed-files.json 缺少 path: ${index}`)
      }
      return path.trim().replace(/\\/g, '/')
    })
  }

  function parseTesterEvidence(content: string): PipelineTestEvidence[] {
    const parsed = JSON.parse(content) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('patch-set test-evidence.json 不是非空数组')
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`patch-set test-evidence.json 包含非法对象: ${index}`)
      }
      const record = item as Record<string, unknown>
      const command = typeof record.command === 'string' ? record.command.trim() : ''
      const status = typeof record.status === 'string' ? record.status.trim() : ''
      const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
      if (!command || !['passed', 'failed', 'skipped'].includes(status) || !summary) {
        throw new Error(`patch-set test-evidence.json 缺少或非法字段: ${index}`)
      }
      return {
        command,
        status: status as PipelineTestEvidence['status'],
        summary,
        durationMs: typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
          ? record.durationMs
          : undefined,
      }
    })
  }

  function assertTesterPatchSetExcludesPatchWork(repositoryRoot: string): void {
    const patch = readPatchWorkManifestFile({
      repositoryRoot,
      relativePath: 'patch-set/changes.patch',
    })
    const changedFilesContent = readPatchWorkManifestFile({
      repositoryRoot,
      relativePath: 'patch-set/changed-files.json',
    })
    const changedFiles = parsePatchSetChangedFilePaths(changedFilesContent)
    const hasPatchWorkFile = patchTextContainsPatchWorkFile(patch)
      || changedFiles.some((path) => path === 'patch-work' || path.startsWith('patch-work/'))

    if (hasPatchWorkFile) {
      throw new Error('patch-set 包含 patch-work/**，禁止进入提交草稿')
    }
  }

  function assertTesterEvidenceAllowsApprove(
    repositoryRoot: string,
    gateKind: PipelineGateKind,
  ): void {
    const evidenceContent = readPatchWorkManifestFile({
      repositoryRoot,
      relativePath: 'patch-set/test-evidence.json',
    })
    const evidence = parseTesterEvidence(evidenceContent)

    if (gateKind === 'test_blocked') return

    const hasNonPassingEvidence = evidence.some((item) => item.status !== 'passed')
    if (hasNonPassingEvidence) {
      throw new Error('tester 测试证据未全部通过，禁止以正常审核进入提交草稿')
    }
  }

  function ensureV2ContributionTask(
    meta: PipelineSessionMeta,
    workspaceId: string | undefined,
  ): void {
    if (meta.version !== 2) return

    const existing = getContributionTaskByPipelineSessionId(meta.id)
    if (existing) {
      if (existing.status === 'created') {
        updateContributionTask(existing.id, { status: 'exploring' })
      }
      return
    }

    if (!workspaceId) {
      throw new Error('Pipeline v2 需要先选择工作区，才能创建贡献任务。')
    }

    const workspace = getAgentWorkspace(workspaceId)
    if (!workspace) {
      throw new Error(`Pipeline v2 工作区不存在: ${workspaceId}`)
    }

    const repositoryRoot = getAgentSessionWorkspacePath(workspace.slug, meta.id)
    const task = createContributionTask({
      pipelineSessionId: meta.id,
      workspaceId,
      repositoryRoot,
      patchWorkDir: join(repositoryRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'exploring',
    })

    initializePatchWork({
      contributionTaskId: task.id,
      pipelineSessionId: meta.id,
      repositoryRoot,
    })
    appendContributionTaskEvent(task.id, {
      pipelineSessionId: meta.id,
      type: 'task_created',
      payload: {
        repositoryRoot,
        contributionMode: 'local_patch',
      },
    })
  }

  function applyV2GateSideEffects(
    pendingGate: PipelineGateRequest,
    response: PipelineGateResponse,
  ): void {
    if (response.action !== 'approve') {
      if (pendingGate.kind === 'document_review' && pendingGate.node === 'planner') {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: 'planning',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      if (pendingGate.kind === 'document_review' && pendingGate.node === 'developer') {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: 'developing',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      if (pendingGate.kind === 'review_iteration_limit') {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: response.action === 'rerun_node' ? 'reviewing' : 'developing',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      if (
        (pendingGate.kind === 'document_review' || pendingGate.kind === 'test_blocked')
        && pendingGate.node === 'tester'
      ) {
        const task = getContributionTaskForSession(response.sessionId)
        if (task) {
          updateContributionTask(task.id, {
            status: response.action === 'reject_with_feedback' ? 'developing' : 'testing',
            currentGateId: pendingGate.gateId,
          })
        }
      }
      return
    }

    if (pendingGate.kind === 'task_selection') {
      if (!response.selectedReportId) {
        throw new Error('请选择 explorer report 后再进入 planner')
      }

      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      const result = selectPatchWorkTask({
        repositoryRoot: task.repositoryRoot,
        selectedReportId: response.selectedReportId,
        gateId: pendingGate.gateId,
      })
      updateContributionTask(task.id, {
        selectedReportId: response.selectedReportId,
        selectedTaskTitle: result.selectedReport.title,
        status: 'task_selected',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          selectedReportId: response.selectedReportId,
          selectedTaskPath: result.selectedTaskRef.relativePath,
        },
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'task_selected',
          selectedReportId: response.selectedReportId,
          selectedTaskTitle: result.selectedReport.title,
        },
      })
      return
    }

    if (pendingGate.kind === 'document_review' && pendingGate.node === 'planner') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: ['implementation_plan', 'test_plan'],
      })
      updateContributionTask(task.id, {
        status: 'developing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
        },
      })
    }

    if (pendingGate.kind === 'document_review' && pendingGate.node === 'developer') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: ['dev_doc'],
      })
      updateContributionTask(task.id, {
        status: 'reviewing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
        },
      })
      return
    }

    if (pendingGate.kind === 'review_iteration_limit') {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      updateContributionTask(task.id, {
        status: 'testing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'testing',
          reason: 'review_iteration_limit_accepted',
        },
      })
    }

    if (
      (pendingGate.kind === 'document_review' || pendingGate.kind === 'test_blocked')
      && pendingGate.node === 'tester'
    ) {
      const task = getContributionTaskForSession(response.sessionId)
      if (!task) return

      assertTesterPatchSetExcludesPatchWork(task.repositoryRoot)
      assertTesterEvidenceAllowsApprove(task.repositoryRoot, pendingGate.kind)
      const accepted = acceptPatchWorkDocuments({
        repositoryRoot: task.repositoryRoot,
        gateId: pendingGate.gateId,
        kinds: ['test_result', 'patch', 'changed_files', 'diff_summary', 'test_evidence'],
      })
      updateContributionTask(task.id, {
        status: 'committing',
        currentGateId: undefined,
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'patch_work_updated',
        payload: {
          acceptedDocuments: accepted.map((file) => ({
            relativePath: file.relativePath,
            checksum: file.checksum,
            revision: file.revision,
          })),
          riskAccepted: pendingGate.kind === 'test_blocked',
        },
      })
      appendContributionTaskEvent(task.id, {
        pipelineSessionId: response.sessionId,
        type: 'task_updated',
        payload: {
          status: 'committing',
          reason: pendingGate.kind === 'test_blocked'
            ? 'test_blocked_risk_accepted'
            : 'tester_result_accepted',
        },
      })
    }
  }

  async function buildDefaultGraph(
    meta: PipelineSessionMeta,
    signal?: AbortSignal,
    callbacks?: PipelineServiceCallbacks,
    mode: 'execute' | 'read' = 'read',
  ): Promise<PipelineGraphController> {
    const { RoutedPipelineNodeRunner } = await import('./pipeline-node-router')
    const codexChannelId = resolvePipelineCodexChannelId(getSettings())
    const runner = new RoutedPipelineNodeRunner({
      version: meta.version ?? 1,
      claudeChannelId: meta.channelId,
      codexChannelId,
      workspaceId: meta.workspaceId,
      codexBackend: process.env.RV_PIPELINE_CODEX_BACKEND === 'cli' ? 'cli' : 'sdk',
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

    if (mode === 'execute') {
      activeRunners.set(meta.id, runner)
    }

    const createGraph = meta.version === 2 ? createPipelineGraphV2 : createPipelineGraph
    return createGraph({
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
        kind: current.interrupted.kind,
        gateId: current.interrupted.gateId,
        title: current.interrupted.title,
        summary: current.interrupted.summary,
        feedbackHint: current.interrupted.feedbackHint,
        iteration: current.interrupted.iteration,
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
        kind: response.kind ?? current.interrupted.kind,
        action: response.action,
        feedback: response.feedback,
        selectedReportId: response.selectedReportId,
        submissionMode: response.submissionMode,
        createdAt: response.createdAt,
      })
      emitEvent(meta.id, callbacks, {
        type: 'gate_resolved',
        response,
        createdAt: Date.now(),
      })

      const latestMeta = getPipelineSessionMeta(meta.id)
      if (!latestMeta) return

      const graph = await Promise.resolve(createGraph(latestMeta, controller?.signal, callbacks, 'execute'))
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

      const graph = await Promise.resolve(createGraph(latestMeta, controller.signal, callbacks, 'execute'))
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
    async listSessions(): Promise<PipelineSessionMeta[]> {
      return reconcileSessions()
    },

    createSession(
      title?: string,
      channelId?: string,
      workspaceId?: string,
      version?: PipelineVersion,
    ): PipelineSessionMeta {
      return createPipelineSession(title, channelId, workspaceId, version)
    },

    getRecords(sessionId: string) {
      return getPipelineRecords(sessionId)
    },

    getRecordsTail(input: PipelineRecordsTailInput): PipelineRecordsTailResult {
      return getPipelineRecordsTail(input)
    },

    async searchRecords(input: PipelineRecordsSearchInput): Promise<PipelineRecordsSearchResult> {
      return searchPipelineRecordsPage(input)
    },

    readArtifactContent(input: PipelineArtifactContentInput): string {
      return readPipelineArtifactContent(input.sessionId, input.ref)
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

      const effectiveWorkspaceId = input.workspaceId ?? meta.workspaceId
      ensureV2ContributionTask(meta, effectiveWorkspaceId)

      updatePipelineSessionMeta(meta.id, {
        channelId: input.channelId ?? meta.channelId,
        workspaceId: effectiveWorkspaceId,
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
      const activePendingGate = gateService
        .getPendingRequests()
        .find((request) => request.gateId === response.gateId && request.sessionId === response.sessionId)
      if (activePendingGate) {
        applyV2GateSideEffects(activePendingGate, response)
      }
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

      applyV2GateSideEffects(pendingGate, response)
      appendPipelineRecord(meta.id, {
        id: `${meta.id}-${response.gateId}-response`,
        sessionId: meta.id,
        type: 'gate_decision',
        node: pendingGate.node,
        kind: response.kind ?? pendingGate.kind,
        action: response.action,
        feedback: response.feedback,
        selectedReportId: response.selectedReportId,
        submissionMode: response.submissionMode,
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

    stop(sessionId: string): PipelineStateSnapshot {
      const meta = getPipelineSessionMeta(sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${sessionId}`)
      }

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

      return {
        sessionId: updatedMeta.id,
        version: updatedMeta.version,
        currentNode: updatedMeta.currentNode,
        status: 'terminated',
        reviewIteration: updatedMeta.reviewIteration,
        lastApprovedNode: updatedMeta.lastApprovedNode,
        pendingGate: null,
        updatedAt: updatedMeta.updatedAt,
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

    getPatchWorkManifest(input: PipelinePatchWorkSessionInput) {
      const parsed = parsePatchWorkSessionInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return readPatchWorkManifest(task!.repositoryRoot)
    },

    readPatchWorkFile(input: PipelinePatchWorkReadFileInput): string {
      const parsed = parsePatchWorkReadFileInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return readPatchWorkManifestFile({
        repositoryRoot: task!.repositoryRoot,
        relativePath: parsed.relativePath,
      })
    },

    listExplorerReports(input: PipelinePatchWorkSessionInput): PipelineExplorerReportRef[] {
      const parsed = parsePatchWorkSessionInput(input)
      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      return listPatchWorkExplorerReports({
        repositoryRoot: task!.repositoryRoot,
      })
    },

    async selectTask(
      input: PipelineSelectTaskInput,
      callbacks?: PipelineServiceCallbacks,
    ): Promise<PipelineSelectTaskResult> {
      const parsed = parseSelectTaskInput(input)
      const meta = getPipelineSessionMeta(parsed.sessionId)
      if (!meta) {
        throw new Error(`未找到 Pipeline 会话: ${parsed.sessionId}`)
      }
      const pendingGate = meta.pendingGate
      if (!pendingGate || pendingGate.gateId !== parsed.gateId || pendingGate.kind !== 'task_selection') {
        throw new Error('Pipeline task selection gate 不匹配，请刷新后重试')
      }

      await this.respondGate({
        gateId: parsed.gateId,
        sessionId: parsed.sessionId,
        kind: 'task_selection',
        action: 'approve',
        selectedReportId: parsed.selectedReportId,
        createdAt: Date.now(),
      }, callbacks)

      const task = getContributionTaskForSession(parsed.sessionId, { required: true })
      const reports = listPatchWorkExplorerReports({ repositoryRoot: task!.repositoryRoot })
      const selectedReport = reports.find((report) => report.reportId === parsed.selectedReportId)
      const manifest = readPatchWorkManifest(task!.repositoryRoot)
      const selectedTaskRef = manifest.files.find((file) => file.kind === 'selected_task')
      if (!selectedReport || !selectedTaskRef) {
        throw new Error('选择任务后未找到 selected-task.md，请刷新后重试')
      }

      return {
        manifest,
        selectedReport,
        selectedTaskRef,
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
