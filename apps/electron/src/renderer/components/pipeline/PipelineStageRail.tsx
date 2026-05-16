import * as React from 'react'
import type { PipelineNodeKind, PipelineStateSnapshot, PipelineVersion } from '@rv-insights/shared'
import {
  AlertCircle,
  Check,
  Circle,
  Loader2,
  PauseCircle,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildPipelineStageViewModels, type PipelineStageVisualStatus } from './pipeline-display-model'

const STEP_TONE_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'border-status-success-border bg-status-success-bg text-status-success-fg',
  active: 'border-status-running-border bg-status-running-bg text-status-running-fg',
  waiting: 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
  failed: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
  stopped: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
  todo: 'border-border-subtle bg-surface-card text-text-tertiary',
}

const CONNECTOR_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'bg-status-success',
  active: 'bg-status-running',
  waiting: 'bg-status-waiting',
  failed: 'bg-status-danger',
  stopped: 'bg-status-neutral',
  todo: 'bg-border-subtle',
}

function StageIcon({ status }: { status: PipelineStageVisualStatus }): React.ReactElement {
  switch (status) {
    case 'done':
      return <Check size={14} />
    case 'active':
      return <Loader2 size={14} className="animate-spin" />
    case 'waiting':
      return <PauseCircle size={14} />
    case 'failed':
      return <AlertCircle size={14} />
    case 'stopped':
      return <Square size={12} />
    case 'todo':
    default:
      return <Circle size={10} />
  }
}

export function PipelineStageRail({
  onSelectStage,
  state,
  version,
}: {
  onSelectStage?: (node: PipelineNodeKind) => void
  state: PipelineStateSnapshot | null
  version?: PipelineVersion
}): React.ReactElement {
  const stages = buildPipelineStageViewModels(state, { version })

  return (
    <section className="rounded-panel border border-border-subtle bg-surface-card px-4 py-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            阶段轨
          </div>
          <h2 className="mt-1 text-sm font-semibold text-text-primary">贡献工作流进度</h2>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-secondary">
          {stages.length} 个阶段
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <div key={stage.node} className="relative min-w-0">
            {index > 0 ? (
              <div
                className={cn(
                  'absolute -left-2 top-5 hidden h-px w-2 transition-colors sm:block',
                  CONNECTOR_CLASS[stages[index - 1]?.status ?? 'todo'],
                )}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onSelectStage?.(stage.node)}
              aria-label={`定位${stage.ariaLabel}记录`}
              className="group flex h-full min-h-[86px] w-full min-w-0 flex-col items-start gap-2 rounded-card border border-border-subtle bg-surface-panel/40 px-3 py-3 text-left outline-none transition-[background-color,border-color,box-shadow] duration-fast hover:border-primary/30 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border transition-colors',
                  STEP_TONE_CLASS[stage.status],
                )}
                aria-hidden="true"
              >
                <StageIcon status={stage.status} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-text-primary">{stage.label}</span>
                <span
                  className={cn(
                    'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    STEP_TONE_CLASS[stage.status],
                  )}
                >
                  {stage.statusLabel}
                </span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
