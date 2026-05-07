import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { GitBranch, Plus, Settings } from 'lucide-react'
import { appModeAtom } from '@/atoms/app-mode'
import { activeViewAtom } from '@/atoms/active-view'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { agentChannelIdAtom, currentAgentWorkspaceIdAtom } from '@/atoms/agent-atoms'
import { currentPipelineSessionIdAtom, pipelineSessionsAtom } from '@/atoms/pipeline-atoms'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { ModeSwitcher } from '@/components/app-shell/ModeSwitcher'

export function PipelineSidebar(): React.ReactElement {
  const sessions = useAtomValue(pipelineSessionsAtom)
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const currentPipelineSessionId = useAtomValue(currentPipelineSessionIdAtom)
  const currentChannelId = useAtomValue(agentChannelIdAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const setCurrentPipelineSessionId = useSetAtom(currentPipelineSessionIdAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const setActiveView = useSetAtom(activeViewAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSessions = useSetAtom(pipelineSessionsAtom)
  const openSession = useOpenSession()
  const visibleSessions = React.useMemo(
    () => sessions.filter((session) => !draftSessionIds.has(session.id)),
    [draftSessionIds, sessions],
  )

  const handleCreate = React.useCallback(async () => {
      const meta = await window.electronAPI.createPipelineSession(
        undefined,
        currentChannelId ?? undefined,
        currentWorkspaceId ?? undefined,
      )
    setSessions((prev) => [meta, ...prev])
    setCurrentPipelineSessionId(meta.id)
    setAppMode('pipeline')
    setActiveView('conversations')
    openSession('pipeline', meta.id, meta.title)
  }, [currentChannelId, currentWorkspaceId, openSession, setActiveView, setAppMode, setCurrentPipelineSessionId, setSessions])

  return (
    <div className="flex h-full w-[272px] flex-col rounded-[28px] bg-sidebar-panel px-4 py-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Mode</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
            <GitBranch size={16} />
            Pipeline
          </div>
        </div>
        <button
          onClick={() => {
            setSettingsTab('agent')
            setSettingsOpen(true)
          }}
          className="rounded-2xl bg-white/80 p-2 text-zinc-700 shadow-sm titlebar-no-drag"
        >
          <Settings size={16} />
        </button>
      </div>

      <ModeSwitcher />

      <button
        onClick={() => void handleCreate()}
        className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white titlebar-no-drag"
      >
        <Plus size={16} />
        新建 Pipeline
      </button>

      <div className="mt-5 text-xs uppercase tracking-[0.22em] text-muted-foreground">Sessions</div>
      <div className="mt-3 flex-1 space-y-2 overflow-auto">
        {visibleSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => {
              setCurrentPipelineSessionId(session.id)
              openSession('pipeline', session.id, session.title)
            }}
            className={`w-full rounded-2xl px-3 py-3 text-left shadow-sm transition-colors titlebar-no-drag ${
              session.id === currentPipelineSessionId
                ? 'bg-zinc-900 text-white'
                : 'bg-white/80 text-zinc-900'
            }`}
          >
            <div className="truncate text-sm font-medium">{session.title}</div>
            <div className="mt-1 text-xs opacity-70">{session.status}</div>
          </button>
        ))}
        {visibleSessions.length === 0 ? (
          <div className="rounded-2xl bg-white/70 px-3 py-5 text-center text-sm text-muted-foreground">
            暂无 Pipeline 会话
          </div>
        ) : null}
      </div>
    </div>
  )
}
