import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  Archive,
  ArchiveRestore,
  AlertCircle,
  ArrowLeft,
  Clock3,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Zap,
  Plug,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { appModeAtom } from '@/atoms/app-mode'
import { activeViewAtom } from '@/atoms/active-view'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import {
  agentChannelIdAtom,
  agentWorkspacesAtom,
  currentAgentWorkspaceIdAtom,
  workspaceCapabilitiesVersionAtom,
} from '@/atoms/agent-atoms'
import {
  currentPipelineSessionIdAtom,
  pipelineSidebarViewModeAtom,
  pipelineSessionIndicatorMapAtom,
  pipelineSessionsAtom,
} from '@/atoms/pipeline-atoms'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import { activeTabIdAtom, closeTab, sidebarCollapsedAtom, tabsAtom, updateTabTitle } from '@/atoms/tab-atoms'
import { userProfileAtom } from '@/atoms/user-profile'
import { hasUpdateAtom } from '@/atoms/updater'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { ModeSwitcher } from '@/components/app-shell/ModeSwitcher'
import { SearchDialog } from '@/components/app-shell/SearchDialog'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { WorkspaceSelector } from '@/components/agent/WorkspaceSelector'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import type { PipelineSessionMeta, WorkspaceCapabilities } from '@rv-insights/shared'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import {
  buildPipelineSidebarSections,
  buildPipelineSidebarSessionSummary,
  type PipelineSidebarSessionTone,
} from './pipeline-session-sidebar-model'

type SessionLeftAccent = 'running' | 'waiting' | 'success' | 'danger'

const SESSION_LEFT_ACCENT_CLASS: Record<SessionLeftAccent, string> = {
  running: 'bg-status-running',
  waiting: 'bg-status-waiting',
  success: 'bg-status-success',
  danger: 'bg-status-danger',
}

const SUMMARY_SIGNAL_CLASS: Record<PipelineSidebarSessionTone, string> = {
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
  running: 'bg-status-running-bg text-status-running-fg',
  waiting: 'bg-status-waiting-bg text-status-waiting-fg',
  failed: 'bg-status-danger-bg text-status-danger-fg',
  success: 'bg-status-success-bg text-status-success-fg',
}

const SUMMARY_SIGNAL_BORDER_CLASS: Record<PipelineSidebarSessionTone, string> = {
  neutral: 'border-status-neutral-border',
  running: 'border-status-running-border',
  waiting: 'border-status-waiting-border',
  failed: 'border-status-danger-border',
  success: 'border-status-success-border',
}

const CONTRIBUTION_PIPELINE_VERSION = 2

function indicatorToAccent(indicator: SessionIndicatorStatus): SessionLeftAccent | undefined {
  switch (indicator) {
    case 'running':
      return 'running'
    case 'blocked':
      return 'waiting'
    case 'failed':
      return 'danger'
    case 'completed':
      return 'success'
    default:
      return undefined
  }
}

interface PipelineSessionItemProps {
  session: PipelineSessionMeta
  active: boolean
  hovered: boolean
  indicatorStatus: SessionIndicatorStatus
  showPinIcon?: boolean
  onSelect: () => void
  onRename: (id: string, title: string) => Promise<void>
  onTogglePin: (id: string) => Promise<void>
  onToggleArchive: (id: string) => Promise<void>
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function PipelineSessionItem({
  session,
  active,
  hovered,
  indicatorStatus,
  showPinIcon,
  onSelect,
  onRename,
  onTogglePin,
  onToggleArchive,
  onMouseEnter,
  onMouseLeave,
}: PipelineSessionItemProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)
  const leftAccent = indicatorToAccent(indicatorStatus)
  const summary = React.useMemo(() => buildPipelineSidebarSessionSummary(session), [session])
  const SignalIcon = summary.tone === 'running'
    ? Loader2
    : summary.tone === 'waiting'
      ? Clock3
      : summary.tone === 'failed'
        ? AlertCircle
        : null

  const startEdit = (): void => {
    setEditTitle(session.title)
    setEditing(true)
    justStartedEditing.current = true
    setTimeout(() => {
      justStartedEditing.current = false
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 300)
  }

  const saveTitle = async (): Promise<void> => {
    if (justStartedEditing.current) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === session.title) {
      setEditing(false)
      return
    }
    await onRename(session.id, trimmed)
    setEditing(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void saveTitle()
    } else if (event.key === 'Escape') {
      setEditing(false)
    }
  }

  const handleRowKeyDown = (event: React.KeyboardEvent): void => {
    if (editing) return
    if (event.currentTarget !== event.target) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleRowKeyDown}
      onDoubleClick={(event) => {
        event.stopPropagation()
        startEdit()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'relative w-full min-h-10 flex items-center gap-2 px-3 py-[7px] rounded-control transition-[background-color,color,box-shadow] duration-fast titlebar-no-drag text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active
          ? 'pipeline-session-selected bg-primary/10 shadow-card'
          : 'hover:bg-surface-muted',
      )}
    >
      {leftAccent ? (
        <span
          className={cn(
            'absolute left-1 top-1.5 bottom-1.5 w-[2px] rounded-full pointer-events-none',
            SESSION_LEFT_ACCENT_CLASS[leftAccent],
          )}
        />
      ) : null}

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => void saveTitle()}
            onClick={(event) => event.stopPropagation()}
            className="w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0"
            maxLength={100}
          />
        ) : (
          <>
            <div
              className={cn(
                'truncate text-[13px] leading-5 flex items-center gap-1.5',
                active ? 'text-foreground' : 'text-foreground/80',
              )}
            >
              {showPinIcon ? <Pin size={11} className="flex-shrink-0 text-primary/60" /> : null}
              <span className="truncate">{session.title}</span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-foreground/45">
              <span className="truncate">{summary.detailLabel}</span>
              {summary.signalLabel ? (
                <span
                  className={cn(
                    'inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                    SUMMARY_SIGNAL_CLASS[summary.tone],
                    SUMMARY_SIGNAL_BORDER_CLASS[summary.tone],
                  )}
                >
                  {SignalIcon ? (
                    <SignalIcon size={10} className={summary.tone === 'running' ? 'animate-spin' : ''} />
                  ) : null}
                  {summary.signalLabel}
                </span>
              ) : (
                <span className="truncate">{summary.statusLabel}</span>
              )}
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          'flex items-center gap-0.5 flex-shrink-0 transition-all duration-fast overflow-hidden',
          hovered && !editing ? 'opacity-100' : 'opacity-0 w-0 pointer-events-none',
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(event) => {
                event.stopPropagation()
                void onTogglePin(session.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={session.pinned ? `取消置顶 Pipeline：${session.title}` : `置顶 Pipeline：${session.title}`}
            >
              {session.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{session.pinned ? '取消置顶' : '置顶会话'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(event) => {
                event.stopPropagation()
                startEdit()
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`重命名 Pipeline：${session.title}`}
            >
              <Pencil size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">重命名</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(event) => {
                event.stopPropagation()
                void onToggleArchive(session.id)
              }}
              className="p-1 rounded-control text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={session.archived ? `取消归档 Pipeline：${session.title}` : `归档 Pipeline：${session.title}`}
            >
              {session.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{session.archived ? '取消归档' : '归档'}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export function PipelineSidebar(): React.ReactElement {
  const [userProfile, setUserProfile] = useAtom(userProfileAtom)
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom)
  const [tabs, setTabs] = useAtom(tabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const [viewMode, setViewMode] = useAtom(pipelineSidebarViewModeAtom)
  const sessions = useAtomValue(pipelineSessionsAtom)
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const currentPipelineSessionId = useAtomValue(currentPipelineSessionIdAtom)
  const currentChannelId = useAtomValue(agentChannelIdAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const indicatorMap = useAtomValue(pipelineSessionIndicatorMapAtom)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)
  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const setCurrentPipelineSessionId = useSetAtom(currentPipelineSessionIdAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const setActiveView = useSetAtom(activeViewAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSearchOpen = useSetAtom(searchDialogOpenAtom)
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const openSession = useOpenSession()
  const syncActiveTabSideEffects = useSyncActiveTabSideEffects()
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)

  React.useEffect(() => {
    window.electronAPI.getUserProfile().then(setUserProfile).catch(console.error)
  }, [setUserProfile])

  React.useEffect(() => {
    if (!currentPipelineSessionId) return
    requestAnimationFrame(() => {
      const element = document.querySelector('.pipeline-session-selected')
      element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [currentPipelineSessionId])

  const currentWorkspaceSlug = React.useMemo(() => {
    if (!currentWorkspaceId) return null
    return workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.slug ?? null
  }, [currentWorkspaceId, workspaces])

  React.useEffect(() => {
    if (!currentWorkspaceSlug) {
      setCapabilities(null)
      return
    }
    window.electronAPI
      .getWorkspaceCapabilities(currentWorkspaceSlug)
      .then(setCapabilities)
      .catch(console.error)
  }, [capabilitiesVersion, currentWorkspaceSlug])

  const sessionSections = React.useMemo(
    () => buildPipelineSidebarSections({
      sessions,
      currentWorkspaceId,
      draftSessionIds,
      viewMode,
    }),
    [currentWorkspaceId, draftSessionIds, sessions, viewMode],
  )

  const archivedSessionCount = React.useMemo(
    () => sessions.filter((session) =>
      session.archived
      && !draftSessionIds.has(session.id)
      && (!currentWorkspaceId || session.workspaceId === currentWorkspaceId),
    ).length,
    [currentWorkspaceId, draftSessionIds, sessions],
  )

  const hasVisibleSessions = sessionSections.length > 0

  const handleCreate = React.useCallback(async () => {
    const meta = await window.electronAPI.createPipelineSession(
      undefined,
      currentChannelId ?? undefined,
      currentWorkspaceId ?? undefined,
      CONTRIBUTION_PIPELINE_VERSION,
    )
    setSessions((prev) => [meta, ...prev])
    setCurrentPipelineSessionId(meta.id)
    setViewMode('active')
    setAppMode('pipeline')
    setActiveView('conversations')
    openSession('pipeline', meta.id, meta.title)
  }, [currentChannelId, currentWorkspaceId, openSession, setActiveView, setAppMode, setCurrentPipelineSessionId, setSessions, setViewMode])

  const handleSelectSession = React.useCallback((sessionId: string, title: string): void => {
    setCurrentPipelineSessionId(sessionId)
    setAppMode('pipeline')
    setActiveView('conversations')
    openSession('pipeline', sessionId, title)
  }, [openSession, setActiveView, setAppMode, setCurrentPipelineSessionId])

  const handleRename = React.useCallback(async (sessionId: string, title: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.updatePipelineTitle(sessionId, title)
      setSessions((prev) => prev.map((session) => (session.id === updated.id ? updated : session)))
      setTabs((prev) => updateTabTitle(prev, sessionId, title))
    } catch (error) {
      console.error('[PipelineSidebar] 重命名 Pipeline 会话失败:', error)
    }
  }, [setSessions, setTabs])

  const handleTogglePin = React.useCallback(async (sessionId: string): Promise<void> => {
    try {
      const original = sessions.find((session) => session.id === sessionId)
      const updated = await window.electronAPI.togglePinPipelineSession(sessionId)
      setSessions((prev) =>
        prev
          .map((session) => (session.id === updated.id ? updated : session))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      )
      if (original?.archived && updated.pinned && !updated.archived) {
        toast.success('已取消归档并置顶')
      }
    } catch (error) {
      console.error('[PipelineSidebar] 切换 Pipeline 会话置顶失败:', error)
    }
  }, [sessions, setSessions])

  const handleToggleArchive = React.useCallback(async (sessionId: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.toggleArchivePipelineSession(sessionId)
      setSessions((prev) =>
        prev
          .map((session) => (session.id === updated.id ? updated : session))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      )

      if (updated.archived) {
        const wasActive = activeTabId === sessionId
        const tabResult = closeTab(tabs, activeTabId, sessionId)
        setTabs(tabResult.tabs)
        setActiveTabId(tabResult.activeTabId)
        if (wasActive) {
          const nextActiveTab = tabResult.activeTabId
            ? tabResult.tabs.find((tab) => tab.id === tabResult.activeTabId) ?? null
            : null
          syncActiveTabSideEffects(nextActiveTab)
        }
      }

      toast.success(updated.archived ? '已归档' : '已取消归档')
    } catch (error) {
      console.error('[PipelineSidebar] 切换 Pipeline 会话归档失败:', error)
    }
  }, [activeTabId, setActiveTabId, setSessions, setTabs, syncActiveTabSideEffects, tabs])

  if (sidebarCollapsed) {
    return (
      <div
        className="h-full flex flex-col items-center bg-surface-panel rounded-panel border border-border-subtle/45 shadow-panel transition-[width] duration-normal"
        style={{ width: 48, flexShrink: 0 }}
      >
        <div className="pt-[50px]" />

        <div className="pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-control text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="展开侧边栏"
              >
                <PanelLeftOpen size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">展开侧边栏</TooltipContent>
          </Tooltip>
        </div>

        <div className="pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => void handleCreate()}
                className="p-2 rounded-control text-text-primary bg-primary/5 hover:bg-primary/10 transition-colors titlebar-no-drag border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="新建贡献 Pipeline v2"
              >
                <Plus size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">新建贡献 Pipeline v2</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        <div className="pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSettingsOpen(true)}
                className="relative p-1 rounded-control transition-colors titlebar-no-drag hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="打开设置"
              >
                <UserAvatar avatar={userProfile.avatar} size={28} />
                {(hasUpdate || hasEnvironmentIssues) ? (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-status-danger" />
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>

        <SearchDialog />
      </div>
    )
  }

  return (
    <div
      className="h-full flex flex-col bg-surface-panel rounded-panel border border-border-subtle/45 shadow-panel transition-[width] duration-normal"
      style={{ width: 280, minWidth: 180, flexShrink: 1 }}
    >
      <div className="pt-[30px]">
        <div className="flex items-start gap-1.5 px-3">
          <div className="flex-1 min-w-0">
            <ModeSwitcher />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="mt-2 size-9 flex-shrink-0 flex items-center justify-center rounded-control bg-surface-muted text-text-tertiary hover:bg-surface-muted/80 hover:text-text-primary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="收起侧边栏"
              >
                <PanelLeftClose size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">收起侧边栏</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="px-3 pt-2">
        <WorkspaceSelector />
      </div>

      <div className="px-3 pt-2 flex items-center gap-1.5">
        <button
          onClick={() => void handleCreate()}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-control text-[13px] font-medium text-text-primary bg-primary/5 hover:bg-primary/10 transition-colors duration-fast titlebar-no-drag border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="新建贡献 Pipeline v2"
        >
          <Plus size={14} />
          <span>新建贡献 Pipeline</span>
          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            v2
          </span>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex-shrink-0 size-9 flex items-center justify-center rounded-control text-text-tertiary bg-primary/5 hover:bg-primary/10 hover:text-text-primary transition-colors duration-fast titlebar-no-drag border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="搜索 Pipeline 会话"
            >
              <Search size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">搜索 (⌘F)</TooltipContent>
        </Tooltip>
      </div>

      {viewMode === 'archived' ? (
        <div className="px-6 pt-3 pb-1">
          <div className="text-[12px] font-medium text-foreground/40">
            已归档 Pipeline
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3 scrollbar-none min-h-0">
        {sessionSections.map((section) => (
          <div key={section.id} className="mb-1">
            <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-foreground/40 select-none">
              {section.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.sessions.map((session) => (
                <PipelineSessionItem
                  key={`${section.id}-${session.id}`}
                  session={session}
                  active={session.id === currentPipelineSessionId}
                  hovered={session.id === hoveredId}
                  indicatorStatus={indicatorMap.get(session.id) ?? 'idle'}
                  showPinIcon={!!session.pinned}
                  onSelect={() => handleSelectSession(session.id, session.title)}
                  onRename={handleRename}
                  onTogglePin={handleTogglePin}
                  onToggleArchive={handleToggleArchive}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ))}
            </div>
          </div>
        ))}

        {!hasVisibleSessions ? (
          <div className="px-2 py-3 text-[11px] text-foreground/30 text-center select-none">
            {viewMode === 'archived' ? '暂无已归档 Pipeline' : '暂无 Pipeline 会话'}
          </div>
        ) : null}
      </div>

      <div className="px-3 pb-1">
        {viewMode === 'active' ? (
          archivedSessionCount > 0 ? (
            <button
              onClick={() => setViewMode('archived')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-control text-[12px] text-text-tertiary hover:bg-surface-muted hover:text-text-primary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Archive size={13} className="text-foreground/30" />
              <span>已归档 ({archivedSessionCount})</span>
            </button>
          ) : null
        ) : (
          <button
            onClick={() => setViewMode('active')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-control text-[12px] text-text-secondary bg-surface-muted hover:bg-surface-muted/80 hover:text-text-primary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ArrowLeft size={13} className="text-foreground/50" />
            <span>返回活跃 Pipeline</span>
          </button>
        )}
      </div>

      {capabilities ? (
        <div className="px-3 pb-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setSettingsTab('agent')
                  setSettingsOpen(true)
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-control text-[12px] text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors titlebar-no-drag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="配置 MCP 与 Skills"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="flex items-center gap-1">
                    <Plug size={13} className="text-foreground/40" />
                    <span className="tabular-nums">{capabilities.mcpServers.filter((server) => server.enabled).length}</span>
                    <span className="text-foreground/30">MCP</span>
                  </span>
                  <span className="text-foreground/20">·</span>
                  <span className="flex items-center gap-1">
                    <Zap size={13} className="text-foreground/40" />
                    <span className="tabular-nums">{capabilities.skills.length}</span>
                    <span className="text-foreground/30">Skills</span>
                  </span>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">点击配置 MCP 与 Skills</TooltipContent>
          </Tooltip>
        </div>
      ) : null}

      <div className="px-3 pb-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-control transition-colors titlebar-no-drag text-text-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <UserAvatar avatar={userProfile.avatar} size={28} />
          <span className="flex-1 text-sm truncate text-left">{userProfile.userName}</span>
          <div className="relative flex-shrink-0 text-foreground/40">
            <Settings size={16} />
            {(hasUpdate || hasEnvironmentIssues) ? (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-danger" />
            ) : null}
          </div>
        </button>
      </div>

      <SearchDialog />
    </div>
  )
}
