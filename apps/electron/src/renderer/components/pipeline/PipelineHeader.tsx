import * as React from 'react'
import type { PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'
import { cn } from '@/lib/utils'
import { buildPipelineHeaderViewModel, type PipelineDisplayTone } from './pipeline-display-model'

const STATUS_TONE_CLASS: Record<PipelineDisplayTone, string> = {
  neutral: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
  running: 'border-status-running-border bg-status-running-bg text-status-running-fg',
  waiting: 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
  failed: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
  success: 'border-status-success-border bg-status-success-bg text-status-success-fg',
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
    <section className="overflow-hidden rounded-panel border border-border-subtle bg-surface-card text-text-primary shadow-card">
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              {viewModel.eyebrow}
            </span>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-secondary">
              当前节点：{viewModel.nodeLabel}
            </span>
          </div>
          <h1 className="mt-2 break-words text-2xl font-semibold tracking-normal text-text-primary [overflow-wrap:anywhere]">
            {viewModel.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span>{viewModel.summary}</span>
            {viewModel.metaItems.map((item) => (
              <span
                key={item}
                className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-secondary"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <div
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold',
              STATUS_TONE_CLASS[viewModel.statusTone],
            )}
          >
            {viewModel.statusLabel}
          </div>
          <div className="text-xs leading-5 text-text-tertiary">
            进度和人工审核状态会同步到下方阶段轨。
          </div>
        </div>
      </div>
    </section>
  )
}
