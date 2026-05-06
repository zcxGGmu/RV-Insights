import * as React from 'react'
import type { PipelineSessionMeta, PipelineStateSnapshot } from '@rv-insights/shared'

export function PipelineHeader({
  session,
  state,
}: {
  session: PipelineSessionMeta | null
  state: PipelineStateSnapshot | null
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 rounded-3xl bg-white/80 px-5 py-4 shadow-sm">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">RV Pipeline</div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          {session?.title ?? '新 Pipeline 会话'}
        </h1>
      </div>
      <div className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
        状态：{state?.status ?? session?.status ?? 'idle'}
      </div>
    </div>
  )
}
