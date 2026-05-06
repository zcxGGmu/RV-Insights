import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import type { PipelineGateRequest, PipelineRecord, PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'
import {
  pipelinePendingGatesAtom,
  pipelineRecordRefreshAtom,
  pipelineSessionStateMapAtom,
  pipelineSessionsAtom,
  pipelineStreamErrorsAtom,
} from '@/atoms/pipeline-atoms'
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
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const [records, setRecords] = React.useState<PipelineRecord[]>([])

  const session = React.useMemo<PipelineSessionMeta | null>(
    () => sessions.find((item) => item.id === sessionId) ?? null,
    [sessions, sessionId],
  )
  const state = stateMap.get(sessionId) ?? null
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
  }, [sessionId, setSessions])

  const handleStart = React.useCallback(async (userInput: string): Promise<void> => {
    await window.electronAPI.startPipeline({
      sessionId,
      userInput,
      channelId: session?.channelId,
      workspaceId: session?.workspaceId,
      threadId: session?.threadId,
    })
  }, [sessionId, session])

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

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-gradient-to-br from-orange-50 via-stone-50 to-amber-100 p-4">
      <PipelineHeader session={session} state={state} />
      <PipelineStageRail state={state} />
      {error ? (
        <div className="rounded-3xl bg-rose-50 px-5 py-4 text-sm text-rose-900 shadow-sm">
          {error}
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
