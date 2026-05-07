import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { agentChannelIdAtom, agentWorkspacesAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import type { PipelineGateRequest, PipelineRecord, PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import {
  pipelinePendingGatesAtom,
  pipelineRecordRefreshAtom,
  pipelineSessionStateMapAtom,
  pipelineSessionsAtom,
  pipelineStreamErrorsAtom,
} from '@/atoms/pipeline-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { resolvePipelineRunConfig, type PipelinePreflightError } from './pipeline-preflight'
import { PipelineComposer } from './PipelineComposer'
import { PipelineGateCard } from './PipelineGateCard'
import { PipelineHeader } from './PipelineHeader'
import { PipelineRecords } from './PipelineRecords'
import { PipelineStageRail } from './PipelineStageRail'

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
  const channels = useAtomValue(channelsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const fallbackChannelId = useAtomValue(agentChannelIdAtom)
  const fallbackWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const setStateMap = useSetAtom(pipelineSessionStateMapAtom)
  const setPendingGates = useSetAtom(pipelinePendingGatesAtom)
  const setErrors = useSetAtom(pipelineStreamErrorsAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const [records, setRecords] = React.useState<PipelineRecord[]>([])
  const [preflightError, setPreflightError] = React.useState<PipelinePreflightError | null>(null)

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

  React.useEffect(() => {
    window.electronAPI.getPipelineRecords(sessionId)
      .then(setRecords)
      .catch(console.error)
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
    setRecords((prev) => [
      ...prev,
      {
        id: `local-user-${Date.now()}`,
        sessionId,
        type: 'user_input',
        content: userInput,
        createdAt: Date.now(),
      },
    ])

    void window.electronAPI.startPipeline({
      sessionId,
      userInput,
      channelId: resolved.config.channelId,
      workspaceId: resolved.config.workspaceId,
      threadId: session?.threadId,
    }).catch((error) => {
      console.error('[PipelineView] 启动失败:', error)
    })
  }, [channels, fallbackChannelId, fallbackWorkspaceId, session, sessionId, setDraftSessionIds, setErrors, setSessions, setStateMap, state, workspaces])

  const handleStop = React.useCallback(async (): Promise<void> => {
    await window.electronAPI.stopPipeline(sessionId)
  }, [sessionId])

  const handleRespond = React.useCallback(async (
    action: 'approve' | 'reject_with_feedback' | 'rerun_node',
    feedback?: string,
  ): Promise<void> => {
    if (!pendingGate) return
    void window.electronAPI.respondPipelineGate({
      gateId: pendingGate.gateId,
      sessionId,
      action,
      feedback,
      createdAt: Date.now(),
    }).catch((error) => {
      console.error('[PipelineView] 响应 gate 失败:', error)
    })
  }, [pendingGate, sessionId])

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-gradient-to-br from-orange-50 via-stone-50 to-amber-100 p-4">
      <PipelineHeader session={session} state={state} />
      <PipelineStageRail state={state} />
      {error ? (
        <div className="rounded-3xl bg-rose-50 px-5 py-4 text-sm text-rose-900 shadow-sm">
          {error}
        </div>
      ) : null}
      {preflightError ? (
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
          <div>{preflightError.message}</div>
          <button
            onClick={() => {
              setSettingsTab(preflightError.settingsTab)
              setSettingsOpen(true)
            }}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-amber-900 shadow-sm"
          >
            前往设置
          </button>
        </div>
      ) : null}
      {pendingGate ? (
        <PipelineGateCard request={pendingGate as PipelineGateRequest} onRespond={handleRespond} />
      ) : null}
      <PipelineComposer disabled={running} onSubmit={handleStart} onStop={handleStop} />
      <PipelineRecords records={records} />
    </div>
  )
}
