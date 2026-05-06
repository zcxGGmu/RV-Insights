import * as React from 'react'
import type { PipelineNodeKind, PipelineStateSnapshot } from '@rv-insights/shared'
import { cn } from '@/lib/utils'

const NODES: PipelineNodeKind[] = [
  'explorer',
  'planner',
  'developer',
  'reviewer',
  'tester',
]

function nodeStatus(node: PipelineNodeKind, state: PipelineStateSnapshot | null): 'done' | 'active' | 'todo' {
  if (!state) return 'todo'
  if (state.lastApprovedNode === node) return 'done'
  if (state.currentNode === node) return 'active'
  return 'todo'
}

export function PipelineStageRail({
  state,
}: {
  state: PipelineStateSnapshot | null
}): React.ReactElement {
  return (
    <div className="grid grid-cols-5 gap-2">
      {NODES.map((node) => {
        const status = nodeStatus(node, state)
        return (
          <div
            key={node}
            className={cn(
              'rounded-2xl border px-3 py-3 text-center shadow-sm transition-colors',
              status === 'done' && 'border-emerald-200 bg-emerald-100 text-emerald-950',
              status === 'active' && 'border-amber-300 bg-amber-200 text-amber-950',
              status === 'todo' && 'border-zinc-200 bg-white text-zinc-500',
            )}
          >
            <div className="text-[11px] uppercase tracking-[0.18em]">{node}</div>
          </div>
        )
      })}
    </div>
  )
}
