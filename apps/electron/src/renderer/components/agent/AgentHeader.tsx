/**
 * AgentHeader — Agent 会话头部
 *
 * 显示会话标题（可点击编辑）。
 * 参照 ChatHeader 的编辑模式。
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Pencil, Check, X, PanelRight, Bot, Cpu, Folder, Radio, ShieldCheck, Waypoints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  agentSessionsAtom,
  agentSidePanelOpenMapAtom,
  agentWorkspacesAtom,
  workspaceFilesVersionAtom,
} from '@/atoms/agent-atoms'
import { channelsAtom } from '@/atoms/chat-atoms'
import { cn } from '@/lib/utils'
import { resolveModelDisplayName } from '@/lib/model-logo'
import { buildAgentHeaderMeta } from './agent-ui-model'

/** AgentHeader 属性接口 */
interface AgentHeaderProps {
  sessionId: string
  channelId?: string | null
  modelId?: string | null
  permissionMode?: string | null
  streaming?: boolean
  planMode?: boolean
}

export function AgentHeader({
  sessionId,
  channelId,
  modelId,
  permissionMode,
  streaming = false,
  planMode = false,
}: AgentHeaderProps): React.ReactElement | null {
  const sessions = useAtomValue(agentSessionsAtom)
  const session = sessions.find((s) => s.id === sessionId) ?? null
  const setAgentSessions = useSetAtom(agentSessionsAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const channels = useAtomValue(channelsAtom)
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 文件面板切换状态
  const sidePanelOpenMap = useAtomValue(agentSidePanelOpenMapAtom)
  const setSidePanelOpenMap = useSetAtom(agentSidePanelOpenMapAtom)
  const filesVersion = useAtomValue(workspaceFilesVersionAtom)
  const isPanelOpen = sidePanelOpenMap.get(sessionId) ?? true
  const hasFileChanges = filesVersion > 0
  const workspaceName = React.useMemo(() => {
    if (!session?.workspaceId) return null
    const workspace = workspaces.find((w) => w.id === session.workspaceId)
    return workspace?.name || workspace?.slug || session.workspaceId
  }, [session?.workspaceId, workspaces])
  const modelName = React.useMemo(() => {
    if (modelId) return resolveModelDisplayName(modelId, channels)
    if (channelId) return channels.find((c) => c.id === channelId)?.name ?? null
    return null
  }, [channelId, channels, modelId])
  const metaItems = React.useMemo(() => buildAgentHeaderMeta({
    workspaceName,
    modelName,
    permissionMode,
    streaming,
    planMode,
  }), [modelName, permissionMode, planMode, streaming, workspaceName])
  const missionState = streaming ? '同步中' : planMode ? '规划中' : '待命'
  const missionStateTone = streaming ? 'running' : planMode ? 'waiting' : 'neutral'

  const togglePanel = React.useCallback(() => {
    setSidePanelOpenMap((prev) => {
      const map = new Map(prev)
      map.set(sessionId, !(map.get(sessionId) ?? true))
      return map
    })
  }, [sessionId, setSidePanelOpenMap])

  if (!session) return null

  /** 进入编辑模式 */
  const startEdit = (): void => {
    setEditTitle(session.title)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  /** 保存标题 */
  const saveTitle = async (): Promise<void> => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === session.title) {
      setEditing(false)
      return
    }

    try {
      await window.electronAPI.updateAgentSessionTitle(session.id, trimmed)
      // 刷新会话列表以同步侧边栏
      const sessions = await window.electronAPI.listAgentSessions()
      setAgentSessions(sessions)
    } catch (error) {
      console.error('[AgentHeader] 更新标题失败:', error)
    }
    setEditing(false)
  }

  /** 键盘事件 */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  return (
    <div className="agent-mission-strip relative z-[51] mx-3 mt-3 flex min-h-[92px] items-center gap-3 rounded-panel border border-border-subtle/65 px-4 py-3 titlebar-drag-region md:mx-5 md:px-5">
      {editing ? (
        <div className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0 titlebar-no-drag">
          <label htmlFor={`agent-title-${session.id}`} className="sr-only">编辑 Agent 会话标题</label>
          <input
            id={`agent-title-${session.id}`}
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveTitle}
            className="flex-1 bg-transparent text-sm font-medium border-b border-primary/50 outline-none px-0 py-0.5 min-w-0 focus-visible:ring-0"
            maxLength={100}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={saveTitle}
                className="inline-flex size-7 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="保存标题"
              >
                <Check className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">保存标题</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditing(false)}
                className="inline-flex size-7 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="取消编辑标题"
              >
                <X className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">取消编辑</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-card border border-border-subtle bg-background/40 agent-status-orb" data-state={missionStateTone === 'neutral' ? 'idle' : 'active'}>
            {streaming ? (
              <Radio className="size-5 text-status-running-fg" />
            ) : planMode ? (
              <Waypoints className="size-5 text-status-waiting-fg" />
            ) : (
              <Bot className="size-5 text-text-secondary" />
            )}
          </div>
          <div className="relative z-10 flex flex-1 min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0">
                <div className="agent-kicker text-[10px] font-semibold uppercase tracking-normal text-text-tertiary">Agent Mission</div>
                <h1 className="truncate text-[17px] font-semibold leading-6 text-text-primary">
                  {session.title}
                </h1>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={startEdit}
                    className="titlebar-no-drag inline-flex size-7 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    aria-label="编辑标题"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">编辑标题</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'agent-meta-chip inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-4',
                  missionStateTone === 'running' && 'border-status-running-border text-status-running-fg',
                  missionStateTone === 'waiting' && 'border-status-waiting-border text-status-waiting-fg',
                  missionStateTone === 'neutral' && 'border-border-subtle text-text-secondary',
                )}
              >
                <Radio className={cn('size-3', streaming && 'animate-pulse')} />
                <span className="font-medium">{missionState}</span>
              </span>
              {metaItems.map((item) => (
                <span
                  key={item.key}
                  className={cn(
                    'agent-meta-chip inline-flex max-w-[220px] items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-4',
                    item.tone === 'running' && 'border-status-running-border bg-status-running-bg text-status-running-fg',
                    item.tone === 'waiting' && 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
                    item.tone === 'neutral' && 'border-border-subtle text-text-secondary',
                  )}
                  title={`${item.label}: ${item.value}`}
                >
                  {item.key === 'workspace' && <Folder className="size-3 shrink-0" />}
                  {item.key === 'model' && <Cpu className="size-3 shrink-0" />}
                  {item.key === 'permission' && <ShieldCheck className="size-3 shrink-0" />}
                  <span className="text-current/65">{item.label}</span>
                  <span className="min-w-0 truncate font-medium">{item.value}</span>
                </span>
              ))}
            </div>
          </div>
          {/* 文件面板打开按钮（仅面板关闭时显示） */}
          {!isPanelOpen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative titlebar-no-drag h-9 w-9 flex-shrink-0 rounded-control border border-border-subtle bg-background/35"
                  onClick={togglePanel}
                  aria-label="打开文件面板"
                >
                  <PanelRight className="size-3.5" />
                  {hasFileChanges && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary animate-pulse" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>打开文件面板</p>
              </TooltipContent>
            </Tooltip>
          )}
        </>
      )}
    </div>
  )
}
