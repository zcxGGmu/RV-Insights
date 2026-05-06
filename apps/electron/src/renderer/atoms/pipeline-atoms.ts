import { atom } from 'jotai'
import type {
  PipelineGateRequest,
  PipelineSessionMeta,
  PipelineStateSnapshot,
  PipelineStreamPayload,
} from '@rv-insights/shared'
import type { SessionIndicatorStatus } from './agent-atoms'

export const pipelineSessionsAtom = atom<PipelineSessionMeta[]>([])
export const currentPipelineSessionIdAtom = atom<string | null>(null)

export const currentPipelineSessionAtom = atom<PipelineSessionMeta | null>((get) => {
  const currentId = get(currentPipelineSessionIdAtom)
  if (!currentId) return null
  return get(pipelineSessionsAtom).find((session) => session.id === currentId) ?? null
})

export const pipelineRecordRefreshAtom = atom<Map<string, number>>(new Map())
export const pipelineSessionStateMapAtom = atom<Map<string, PipelineStateSnapshot>>(new Map())
export const pipelinePendingGatesAtom = atom<Map<string, PipelineGateRequest>>(new Map())
export const pipelineStreamErrorsAtom = atom<Map<string, string>>(new Map())

export const pipelineRunningSessionIdsAtom = atom<Set<string>>((get) => {
  const states = get(pipelineSessionStateMapAtom)
  const result = new Set<string>()
  for (const [sessionId, state] of states.entries()) {
    if (state.status === 'running') {
      result.add(sessionId)
    }
  }
  return result
})

export const pipelineSessionIndicatorMapAtom = atom<Map<string, SessionIndicatorStatus>>((get) => {
  const states = get(pipelineSessionStateMapAtom)
  const map = new Map<string, SessionIndicatorStatus>()

  for (const [sessionId, state] of states.entries()) {
    if (state.status === 'running') {
      map.set(sessionId, 'running')
    } else if (state.status === 'waiting_human' || state.status === 'node_failed') {
      map.set(sessionId, 'blocked')
    } else if (state.status === 'completed') {
      map.set(sessionId, 'completed')
    } else {
      map.set(sessionId, 'idle')
    }
  }

  return map
})

export function upsertPipelineSession(
  sessions: PipelineSessionMeta[],
  next: PipelineSessionMeta,
): PipelineSessionMeta[] {
  const existing = sessions.find((session) => session.id === next.id)
  if (!existing) {
    return [next, ...sessions]
  }

  return sessions
    .map((session) => (session.id === next.id ? { ...session, ...next } : session))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function applyPipelineStreamState(
  prev: PipelineStateSnapshot | undefined,
  payload: PipelineStreamPayload,
): PipelineStateSnapshot | undefined {
  const { event } = payload
  if (!prev && event.type !== 'status_change' && event.type !== 'gate_waiting') {
    return prev
  }

  switch (event.type) {
    case 'status_change':
      return prev
        ? {
            ...prev,
            currentNode: event.currentNode,
            status: event.status,
            updatedAt: event.createdAt,
          }
        : undefined
    case 'gate_waiting':
      return prev
        ? {
            ...prev,
            currentNode: event.request.node,
            status: 'waiting_human',
            pendingGate: event.request,
            updatedAt: event.createdAt,
          }
        : {
            sessionId: payload.sessionId,
            currentNode: event.request.node,
            status: 'waiting_human',
            reviewIteration: event.request.iteration,
            pendingGate: event.request,
            updatedAt: event.createdAt,
          }
    case 'gate_resolved':
      return prev
        ? {
            ...prev,
            pendingGate: null,
            status: 'running',
            updatedAt: event.createdAt,
          }
        : prev
    case 'error':
      return prev
        ? {
            ...prev,
            status: 'node_failed',
            updatedAt: event.createdAt,
          }
        : prev
    case 'node_start':
      return prev
        ? {
            ...prev,
            currentNode: event.node,
            status: 'running',
            updatedAt: event.createdAt,
          }
        : prev
    case 'node_complete':
    case 'text_delta':
    default:
      return prev
  }
}
