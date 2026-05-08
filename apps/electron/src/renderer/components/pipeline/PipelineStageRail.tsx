import * as React from 'react'
import type { PipelineNodeKind, PipelineStateSnapshot } from '@rv-insights/shared'
import {
  AlertCircle,
  Check,
  Circle,
  Loader2,
  PauseCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildPipelineStageViewModels, type PipelineStageVisualStatus } from './pipeline-display-model'

const STEP_TONE_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  active: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300',
  waiting: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  failed: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300',
  todo: 'border-border bg-background text-muted-foreground',
}

const CONNECTOR_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'bg-emerald-200 dark:bg-emerald-500/35',
  active: 'bg-sky-200 dark:bg-sky-500/35',
  waiting: 'bg-amber-200 dark:bg-amber-500/35',
  failed: 'bg-rose-200 dark:bg-rose-500/35',
  todo: 'bg-border',
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
    case 'todo':
    default:
      return <Circle size={10} />
  }
}

export function PipelineStageRail({
  onSelectStage,
  state,
}: {
  onSelectStage?: (node: PipelineNodeKind) => void
  state: PipelineStateSnapshot | null
}): React.ReactElement {
  const stages = buildPipelineStageViewModels(state)

  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div className="flex min-w-[620px] items-center">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.node}>
            {index > 0 ? (
              <div
                className={cn(
                  'mx-2 h-px flex-1 transition-colors',
                  CONNECTOR_CLASS[stages[index - 1]?.status ?? 'todo'],
                )}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onSelectStage?.(stage.node)}
              className="flex min-w-[96px] flex-col items-center gap-2 rounded-xl px-1 py-1 text-center outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border transition-colors',
                  STEP_TONE_CLASS[stage.status],
                )}
                aria-label={`${stage.label}：${stage.status}`}
              >
                <StageIcon status={stage.status} />
              </span>
              <span className="text-center">
                <span className="block text-[13px] font-medium text-foreground">{stage.label}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {stage.node}
                </span>
              </span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
