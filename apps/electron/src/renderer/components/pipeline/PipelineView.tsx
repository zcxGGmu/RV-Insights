import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { agentChannelIdAtom, agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import type { PipelineGateRequest, PipelineNodeKind, PipelineRecord, PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import {
  pipelinePendingGatesAtom,
  pipelineCodexChannelIdAtom,
  getPipelineLiveOutput,
  hasPipelineLiveOutputNode,
  pipelineLiveOutputAtom,
  pipelineRecordRefreshAtom,
  pipelineSessionStateMapAtom,
  pipelineSessionsAtom,
  pipelineStreamErrorsAtom,
} from '@/atoms/pipeline-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { resolvePipelineRunConfig, type PipelinePreflightError } from './pipeline-preflight'
import { PipelineComposer } from './PipelineComposer'
import { PipelineFailureCard } from './PipelineFailureCard'
import { PipelineGateCard } from './PipelineGateCard'
import { PipelineHeader } from './PipelineHeader'
import { PipelineRecords } from './PipelineRecords'
import type { PipelineRecordsFocusRequest } from './PipelineRecords'
import { PipelineStageRail } from './PipelineStageRail'
import { buildPipelineFailureViewModel } from './pipeline-display-model'
import {
  mergePipelineRecordsTail,
  shouldApplyPipelineRecordsTailLoad,
} from './pipeline-record-tail-model'

export function PipelineView({
  sessionId,
}: {
  sessionId: string
}): React.ReactElement {
  const sessions = useAtomValue(pipelineSessionsAtom)
  const stateMap = useAtomValue(pipelineSessionStateMapAtom)
  const pendingGates = useAtomValue(pipelinePendingGatesAtom)
  const refreshMap = useAtomValue(pipelineRecordRefreshAtom)
  const errorMap = useAtomValue(pipelineStreamErrorsAtom)
  const liveOutputMap = useAtomValue(pipelineLiveOutputAtom)
  const channels = useAtomValue(channelsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const fallbackChannelId = useAtomValue(agentChannelIdAtom)
  const fallbackWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const pipelineCodexChannelId = useAtomValue(pipelineCodexChannelIdAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const setStateMap = useSetAtom(pipelineSessionStateMapAtom)
  const setPendingGates = useSetAtom(pipelinePendingGatesAtom)
  const setErrors = useSetAtom(pipelineStreamErrorsAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const [records, setRecords] = React.useState<PipelineRecord[]>([])
  const [preflightError, setPreflightError] = React.useState<PipelinePreflightError | null>(null)
  const [recordsFocusRequest, setRecordsFocusRequest] = React.useState<PipelineRecordsFocusRequest | null>(null)
  const recordsCursorRef = React.useRef(0)
  const recordsLoadSeqRef = React.useRef(0)
  const recordsFocusSeqRef = React.useRef(0)

  const session = React.useMemo<PipelineSessionMeta | null>(
    () => sessions.find((item) => item.id === sessionId) ?? null,
    [sessions, sessionId],
  )
  const state = stateMap.get(sessionId) ?? (session ? {
    sessionId: session.id,
    currentNode: session.currentNode,
    status: session.status,
    reviewIteration: session.reviewIteration,
    lastApprovedNode: session.lastApprovedNode,
    pendingGate: session.pendingGate,
    updatedAt: session.updatedAt,
  } : null)
  const pendingGate = pendingGates.get(sessionId) ?? session?.pendingGate ?? null
  const refreshVersion = refreshMap.get(sessionId) ?? 0
  const error = errorMap.get(sessionId)
  const running = state?.status === 'running' || state?.status === 'waiting_human'
  const currentTask = React.useMemo(() => {
    return [...records].reverse().find((record) => record.type === 'user_input')?.content
  }, [records])
  const latestErrorRecord = React.useMemo(() => {
    return [...records]
      .reverse()
      .find((record): record is Extract<PipelineRecord, { type: 'error' }> => record.type === 'error')
  }, [records])
  const latestRecordError = latestErrorRecord?.error
  const liveOutput = state
    ? getPipelineLiveOutput(liveOutputMap, sessionId, state.currentNode)
    : ''
  const showLiveOutput = state?.status === 'running'
    && hasPipelineLiveOutputNode(liveOutputMap, sessionId, state.currentNode)
  const failureViewModel = React.useMemo(() => buildPipelineFailureViewModel({
    state,
    error: error ?? latestRecordError,
    partialOutput: liveOutput,
  }), [error, latestRecordError, liveOutput, state])

  React.useEffect(() => {
    recordsCursorRef.current = 0
    recordsLoadSeqRef.current += 1
    setRecords([])
  }, [sessionId])

  React.useEffect(() => {
    let cancelled = false

    async function loadRecordsTail(): Promise<void> {
      const loadId = recordsLoadSeqRef.current + 1
      recordsLoadSeqRef.current = loadId
      const afterIndex = recordsCursorRef.current
      let result = await window.electronAPI.getPipelineRecordsTail({
        sessionId,
        afterIndex,
        limit: 300,
      })
      const recordsBatch = [...result.records]

      while (result.hasMore) {
        result = await window.electronAPI.getPipelineRecordsTail({
          sessionId,
          afterIndex: result.nextIndex,
          limit: 300,
        })
        recordsBatch.push(...result.records)
      }

      if (cancelled) return
      if (!shouldApplyPipelineRecordsTailLoad({
        loadId,
        latestLoadId: recordsLoadSeqRef.current,
        afterIndex,
        currentCursor: recordsCursorRef.current,
      })) {
        return
      }

      recordsCursorRef.current = result.nextIndex
      setRecords((prev) => mergePipelineRecordsTail(prev, recordsBatch, afterIndex))
    }

    loadRecordsTail().catch(console.error)
    return () => {
      cancelled = true
    }
  }, [sessionId, refreshVersion])

  React.useEffect(() => {
    window.electronAPI.getPipelineSessionState(sessionId)
      .then((snapshot) => {
        setStateMap((prev) => {
          const next = new Map(prev)
          next.set(sessionId, snapshot)
          return next
        })
        if (snapshot.pendingGate) {
          setPendingGates((prev) => {
            const next = new Map(prev)
            next.set(sessionId, snapshot.pendingGate!)
            return next
          })
        }
        setSessions((prev) => prev.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                currentNode: snapshot.currentNode,
                status: snapshot.status,
                reviewIteration: snapshot.reviewIteration,
                lastApprovedNode: snapshot.lastApprovedNode,
                pendingGate: snapshot.pendingGate,
                updatedAt: snapshot.updatedAt,
              }
            : item,
        ))
      })
      .catch(() => {
        // 还没有 checkpoint 时允许静默失败
      })
  }, [sessionId, setPendingGates, setSessions, setStateMap])

  const handleStart = React.useCallback(async (userInput: string): Promise<void> => {
    const resolved = resolvePipelineRunConfig({
      sessionChannelId: session?.channelId,
      sessionWorkspaceId: session?.workspaceId,
      fallbackChannelId: fallbackChannelId ?? undefined,
      fallbackWorkspaceId: fallbackWorkspaceId ?? undefined,
      pipelineCodexChannelId: pipelineCodexChannelId ?? undefined,
      channels,
      workspaces,
    })
    if (!resolved.ok) {
      setPreflightError(resolved.error)
      return
    }

    const optimisticState: PipelineStateSnapshot = {
      sessionId,
      currentNode: 'explorer',
      status: 'running',
      reviewIteration: state?.reviewIteration ?? session?.reviewIteration ?? 0,
      lastApprovedNode: state?.lastApprovedNode ?? session?.lastApprovedNode,
      pendingGate: null,
      updatedAt: Date.now(),
    }

    setPreflightError(null)
    setErrors((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
    setDraftSessionIds((prev) => {
      if (!prev.has(sessionId)) return prev
      const next = new Set(prev)
      next.delete(sessionId)
      return next
    })
    setStateMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, optimisticState)
      return next
    })
    setSessions((prev) => prev.map((item) => (
      item.id === sessionId
        ? {
            ...item,
            channelId: resolved.config.channelId,
            workspaceId: resolved.config.workspaceId,
            currentNode: optimisticState.currentNode,
            status: optimisticState.status,
            pendingGate: null,
            updatedAt: optimisticState.updatedAt,
          }
        : item
    )))
    void window.electronAPI.startPipeline({
      sessionId,
      userInput,
      channelId: resolved.config.channelId,
      workspaceId: resolved.config.workspaceId,
      threadId: session?.threadId,
    }).catch((error) => {
      console.error('[PipelineView] 启动失败:', error)
      const message = error instanceof Error ? error.message : '启动 Pipeline 失败'
      const failedAt = Date.now()
      const failedState: PipelineStateSnapshot = {
        ...optimisticState,
        status: 'node_failed',
        pendingGate: null,
        updatedAt: failedAt,
      }
      setErrors((prev) => {
        const next = new Map(prev)
        next.set(sessionId, message)
        return next
      })
      setPendingGates((prev) => {
        if (!prev.has(sessionId)) return prev
        const next = new Map(prev)
        next.delete(sessionId)
        return next
      })
      setStateMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, failedState)
        return next
      })
      setSessions((prev) => prev.map((item) => (
        item.id === sessionId
          ? {
              ...item,
              status: failedState.status,
              pendingGate: null,
              updatedAt: failedAt,
            }
          : item
      )))
    })
  }, [channels, fallbackChannelId, fallbackWorkspaceId, pipelineCodexChannelId, session, sessionId, setDraftSessionIds, setErrors, setPendingGates, setSessions, setStateMap, state, workspaces])

  const handleStop = React.useCallback(async (): Promise<void> => {
    await window.electronAPI.stopPipeline(sessionId)
  }, [sessionId])

  const handleRespond = React.useCallback(async (
    action: 'approve' | 'reject_with_feedback' | 'rerun_node',
    feedback?: string,
  ): Promise<void> => {
    if (!pendingGate) return
    await window.electronAPI.respondPipelineGate({
      gateId: pendingGate.gateId,
      sessionId,
      action,
      feedback,
      createdAt: Date.now(),
    })
  }, [pendingGate, sessionId])

  const handleRestart = React.useCallback((): void => {
    if (!currentTask || running) return
    void handleStart(currentTask)
  }, [currentTask, handleStart, running])

  const requestStageFocus = React.useCallback((node: PipelineNodeKind): void => {
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'stage',
      node,
    })
  }, [])

  const requestErrorFocus = React.useCallback((): void => {
    if (!latestErrorRecord) return
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'record',
      recordId: latestErrorRecord.id,
    })
  }, [latestErrorRecord])

  const handleOpenArtifactsDir = React.useCallback(async (): Promise<void> => {
    const opened = await window.electronAPI.openPipelineArtifactsDir(sessionId)
    if (!opened) {
      throw new Error('系统未能打开 Pipeline 产物目录')
    }
  }, [sessionId])

  const handleOpenAgentSettings = React.useCallback((): void => {
    setSettingsTab('agent')
    setSettingsOpen(true)
  }, [setSettingsOpen, setSettingsTab])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-auto bg-muted/25 p-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <PipelineHeader session={session} state={state} />
          <div className="overflow-x-auto">
            <PipelineStageRail state={state} onSelectStage={requestStageFocus} />
          </div>

          {failureViewModel ? (
            <PipelineFailureCard
              viewModel={failureViewModel}
              canLocateError={Boolean(latestErrorRecord)}
              canRestart={Boolean(currentTask) && !running}
              onLocateError={requestErrorFocus}
              onOpenArtifactsDir={handleOpenArtifactsDir}
              onRestart={handleRestart}
              onOpenSettings={handleOpenAgentSettings}
            />
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {preflightError ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <div>{preflightError.message}</div>
              <button
                onClick={() => {
                  setSettingsTab(preflightError.settingsTab)
                  setSettingsOpen(true)
                }}
                className="rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-background/80"
              >
                前往设置
              </button>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              <PipelineRecords
                focusRequest={recordsFocusRequest}
                records={records}
                liveNode={state?.currentNode}
                liveOutput={liveOutput}
                sessionId={sessionId}
                sessionTitle={session?.title}
                showLiveOutput={showLiveOutput}
              />
            </div>
            <aside className="order-first space-y-4 xl:order-none xl:sticky xl:top-4 xl:self-start">
              {pendingGate ? (
                <PipelineGateCard request={pendingGate as PipelineGateRequest} onRespond={handleRespond} />
              ) : null}
              <PipelineComposer
                disabled={running}
                currentTask={currentTask}
                onSubmit={handleStart}
                onStop={handleStop}
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
