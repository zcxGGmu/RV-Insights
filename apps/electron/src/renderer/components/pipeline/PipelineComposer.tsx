import * as React from 'react'
import type { PipelineSessionStatus } from '@rv-insights/shared'

type PipelineComposerNoticeTone = 'neutral' | 'danger'

interface PipelineComposerNotice {
  tone: PipelineComposerNoticeTone
  message: string
}

interface PipelineComposerViewModelInput {
  disabled: boolean
  currentTask?: string
  stopping: boolean
  status?: PipelineSessionStatus | null
  stopError?: string | null
}

export interface PipelineComposerViewModel {
  currentTaskLabel: string
  stopButtonLabel: string
  stopButtonDisabled: boolean
  notice: PipelineComposerNotice | null
}

export function buildPipelineComposerViewModel({
  currentTask,
  stopping,
  status,
  stopError,
}: PipelineComposerViewModelInput): PipelineComposerViewModel {
  let notice: PipelineComposerNotice | null = null

  if (stopping) {
    notice = {
      tone: 'neutral',
      message: '正在停止当前 Pipeline...',
    }
  } else if (stopError) {
    notice = {
      tone: 'danger',
      message: stopError,
    }
  } else if (status === 'terminated') {
    notice = {
      tone: 'neutral',
      message: 'Pipeline 已停止运行，可以调整任务后重新启动。',
    }
  }

  return {
    currentTaskLabel: currentTask || 'Pipeline 正在运行',
    stopButtonLabel: stopping ? '正在停止...' : '停止运行',
    stopButtonDisabled: stopping,
    notice,
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

function PipelineComposerNoticeLine({
  notice,
}: {
  notice: PipelineComposerNotice
}): React.ReactElement {
  const toneClass = notice.tone === 'danger'
    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200'
    : 'bg-muted text-muted-foreground'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 rounded-lg px-3 py-2 text-sm leading-5 ${toneClass}`}
    >
      {notice.message}
    </div>
  )
}

export function PipelineComposer({
  disabled,
  currentTask,
  status,
  onSubmit,
  onStop,
}: {
  disabled: boolean
  currentTask?: string
  status?: PipelineSessionStatus | null
  onSubmit: (input: string) => Promise<void>
  onStop: () => Promise<void>
}): React.ReactElement {
  const [value, setValue] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [stopping, setStopping] = React.useState(false)
  const [stopError, setStopError] = React.useState<string | null>(null)
  const viewModel = buildPipelineComposerViewModel({
    disabled,
    currentTask,
    stopping,
    status,
    stopError,
  })

  const handleSubmit = async (): Promise<void> => {
    const input = value.trim()
    if (!input) return
    setSubmitting(true)
    try {
      await onSubmit(input)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    setStopping(true)
    setStopError(null)
    try {
      await onStop()
    } catch (error) {
      setStopError(`停止 Pipeline 失败: ${formatUnknownError(error)}`)
    } finally {
      setStopping(false)
    }
  }

  if (disabled) {
    return (
      <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">当前任务</div>
            <div className="mt-1 max-h-16 overflow-hidden text-sm leading-6 text-foreground">
              {viewModel.currentTaskLabel}
            </div>
            {viewModel.notice ? (
              <PipelineComposerNoticeLine notice={viewModel.notice} />
            ) : null}
          </div>
          <button
            disabled={viewModel.stopButtonDisabled}
            onClick={() => void handleStop()}
            className="flex-shrink-0 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {viewModel.stopButtonLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <label htmlFor="pipeline-task-input" className="text-sm font-medium text-foreground">
        Pipeline 任务
      </label>
      {viewModel.notice ? (
        <PipelineComposerNoticeLine notice={viewModel.notice} />
      ) : null}
      <textarea
        id="pipeline-task-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入要交给 RV Pipeline 的任务"
        className="mt-2 min-h-28 w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary"
      />
      <div className="mt-3 flex gap-2">
        <button
          disabled={disabled || submitting}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          启动 Pipeline
        </button>
      </div>
    </div>
  )
}
