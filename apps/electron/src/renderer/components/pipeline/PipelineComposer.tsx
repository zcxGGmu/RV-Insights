import * as React from 'react'
import type { PipelineSessionStatus } from '@rv-insights/shared'
import { Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
    : 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 rounded-card border px-3 py-2 text-sm leading-5 ${toneClass}`}
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
      <section className="rounded-panel border border-border-subtle bg-surface-card px-4 py-3 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-[0.16em] text-text-tertiary">当前任务</div>
            <div className="mt-1 max-h-20 overflow-hidden break-words text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">
              {viewModel.currentTaskLabel}
            </div>
            {viewModel.notice ? (
              <PipelineComposerNoticeLine notice={viewModel.notice} />
            ) : null}
          </div>
          <Button
            type="button"
            disabled={viewModel.stopButtonDisabled}
            onClick={() => void handleStop()}
            variant="outline"
            className="flex-shrink-0"
          >
            <Square size={15} />
            {viewModel.stopButtonLabel}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-panel border border-border-subtle bg-surface-card px-4 py-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] text-text-tertiary">操作区</div>
          <label htmlFor="pipeline-task-input" className="mt-1 block text-sm font-semibold text-text-primary">
            Pipeline 任务
          </label>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-secondary">
          等待输入
        </span>
      </div>
      {viewModel.notice ? (
        <PipelineComposerNoticeLine notice={viewModel.notice} />
      ) : null}
      <textarea
        id="pipeline-task-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入要交给 RV Pipeline 的任务"
        className="mt-3 min-h-32 w-full resize-y rounded-card border border-border-subtle bg-background px-3 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-primary focus:ring-2 focus:ring-focus"
      />
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          disabled={disabled || submitting}
          onClick={() => void handleSubmit()}
          loading={submitting}
          loadingLabel="正在启动 Pipeline"
        >
          <Play size={15} />
          启动 Pipeline
        </Button>
      </div>
    </section>
  )
}
