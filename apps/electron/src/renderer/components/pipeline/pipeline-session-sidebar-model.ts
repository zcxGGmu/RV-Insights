import type { PipelineSessionMeta, PipelineSessionStatus } from '@rv-insights/shared'
import type { PipelineSidebarViewMode } from '@/atoms/pipeline-atoms'

type DateGroup = '今天' | '昨天' | '更早'

export interface PipelineSidebarSection {
  id: string
  label: string
  sessions: PipelineSessionMeta[]
}

export interface BuildPipelineSidebarSectionsInput {
  sessions: PipelineSessionMeta[]
  currentWorkspaceId?: string | null
  draftSessionIds: Set<string>
  viewMode: PipelineSidebarViewMode
  now?: number
}

function sortByUpdatedAtDesc(sessions: PipelineSessionMeta[]): PipelineSessionMeta[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
}

function groupByDate(
  sessions: PipelineSessionMeta[],
  nowValue: number,
): PipelineSidebarSection[] {
  const now = new Date(nowValue)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const groups: Record<DateGroup, PipelineSessionMeta[]> = {
    今天: [],
    昨天: [],
    更早: [],
  }

  for (const session of sortByUpdatedAtDesc(sessions)) {
    if (session.updatedAt >= todayStart) {
      groups.今天.push(session)
    } else if (session.updatedAt >= yesterdayStart) {
      groups.昨天.push(session)
    } else {
      groups.更早.push(session)
    }
  }

  return [
    { id: 'date-today', label: '今天', sessions: groups.今天 },
    { id: 'date-yesterday', label: '昨天', sessions: groups.昨天 },
    { id: 'date-earlier', label: '更早', sessions: groups.更早 },
  ].filter((section) => section.sessions.length > 0)
}

function isSameWorkspace(
  session: PipelineSessionMeta,
  currentWorkspaceId?: string | null,
): boolean {
  return !currentWorkspaceId || session.workspaceId === currentWorkspaceId
}

export function getPipelineStatusLabel(status: PipelineSessionStatus): string {
  switch (status) {
    case 'running':
      return '运行中'
    case 'waiting_human':
      return '等待人工审核'
    case 'node_failed':
      return '节点失败'
    case 'completed':
      return '已完成'
    case 'terminated':
      return '已终止'
    case 'recovery_failed':
      return '恢复失败'
    case 'idle':
    default:
      return '空闲'
  }
}

export function buildPipelineSidebarSections({
  sessions,
  currentWorkspaceId,
  draftSessionIds,
  viewMode,
  now = Date.now(),
}: BuildPipelineSidebarSectionsInput): PipelineSidebarSection[] {
  const visibleSessions = sessions.filter((session) =>
    !draftSessionIds.has(session.id) && isSameWorkspace(session, currentWorkspaceId),
  )

  if (viewMode === 'archived') {
    return groupByDate(
      visibleSessions.filter((session) => session.archived),
      now,
    )
  }

  const activeSessions = visibleSessions.filter((session) => !session.archived)
  const pinned = activeSessions.filter((session) => session.pinned)
  const unpinned = activeSessions.filter((session) => !session.pinned)

  const running = unpinned.filter((session) => session.status === 'running')
  const waiting = unpinned.filter((session) => session.status === 'waiting_human')
  const failed = unpinned.filter((session) =>
    session.status === 'node_failed' || session.status === 'recovery_failed',
  )
  const completed = unpinned.filter((session) => session.status === 'completed')
  const recent = unpinned.filter((session) =>
    session.status === 'idle' || session.status === 'terminated',
  )

  return [
    { id: 'pinned', label: '置顶', sessions: sortByUpdatedAtDesc(pinned) },
    { id: 'running', label: '运行中', sessions: sortByUpdatedAtDesc(running) },
    { id: 'waiting_human', label: '等待审核', sessions: sortByUpdatedAtDesc(waiting) },
    { id: 'failed', label: '需要处理', sessions: sortByUpdatedAtDesc(failed) },
    { id: 'completed', label: '已完成', sessions: sortByUpdatedAtDesc(completed) },
    ...groupByDate(recent, now),
  ].filter((section) => section.sessions.length > 0)
}
