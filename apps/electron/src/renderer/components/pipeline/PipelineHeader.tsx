import * as React from 'react'
import type { PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'
import { cn } from '@/lib/utils'
import { buildPipelineHeaderViewModel, type PipelineDisplayTone } from './pipeline-display-model'

const STATUS_TONE_CLASS: Record<PipelineDisplayTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  running: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  waiting: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  failed: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

export function PipelineHeader({
  session,
  state,
}: {
  session: PipelineSessionMeta | null
  state: PipelineStateSnapshot | null
}): React.ReactElement {
  const viewModel = buildPipelineHeaderViewModel({ session, state })

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border bg-card px-5 py-4 text-card-foreground shadow-sm">
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {viewModel.eyebrow}
        </div>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal text-foreground">
          {viewModel.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{viewModel.summary}</span>
          {viewModel.metaItems.map((item) => (
            <React.Fragment key={item}>
              <span className="text-muted-foreground/40">/</span>
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-2">
        <div
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium',
            STATUS_TONE_CLASS[viewModel.statusTone],
          )}
        >
          {viewModel.statusLabel}
        </div>
        <div className="text-xs text-muted-foreground">
          当前节点：{viewModel.nodeLabel}
        </div>
      </div>
    </div>
  )
}
