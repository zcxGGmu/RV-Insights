import * as React from 'react'
import { AlertTriangle, RefreshCw, Settings2 } from 'lucide-react'
import type { PipelineFailureViewModel } from './pipeline-display-model'

export function PipelineFailureCard({
  viewModel,
  canRestart,
  onRestart,
  onOpenSettings,
}: {
  viewModel: PipelineFailureViewModel
  canRestart: boolean
  onRestart: () => void
  onOpenSettings: () => void
}): React.ReactElement {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-950 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle size={16} />
            {viewModel.title}
          </div>
          <div className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-200">
            {viewModel.detailLabel}
          </div>
          <div className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-background/80 px-3 py-2 text-sm leading-6 text-foreground">
            {viewModel.message}
          </div>
          {viewModel.partialOutput ? (
            <>
              <div className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-200">
                {viewModel.partialOutputLabel}
              </div>
              <div className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-background/80 px-3 py-2 text-sm leading-6 text-foreground">
                {viewModel.partialOutput}
              </div>
            </>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <button
            disabled={!canRestart}
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} />
            {viewModel.restartLabel}
          </button>
          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-background/80"
          >
            <Settings2 size={15} />
            {viewModel.settingsLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
