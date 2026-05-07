import * as React from 'react'
import type { PipelineGateRequest } from '@rv-insights/shared'
import { getPipelineNodeLabel } from './pipeline-display-model'

export function PipelineGateCard({
  request,
  onRespond,
}: {
  request: PipelineGateRequest
  onRespond: (action: 'approve' | 'reject_with_feedback' | 'rerun_node', feedback?: string) => Promise<void>
}): React.ReactElement {
  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const nodeLabel = getPipelineNodeLabel(request.node)

  const handleSubmit = async (
    action: 'approve' | 'reject_with_feedback' | 'rerun_node',
  ): Promise<void> => {
    setSubmitting(true)
    try {
      await onRespond(action, feedback.trim() || undefined)
      if (action !== 'approve') {
        setFeedback('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card px-4 py-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            人工审核
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {nodeLabel}节点待确认
          </div>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          第 {request.iteration + 1} 轮
        </div>
      </div>
      {request.summary ? (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm leading-6 text-foreground">
          {request.summary}
        </p>
      ) : null}
      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder={request.feedbackHint ?? '可选反馈'}
        className="mt-3 min-h-24 w-full rounded-xl border bg-background px-3 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={submitting}
          onClick={() => void handleSubmit('approve')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          通过
        </button>
        <button
          disabled={submitting}
          onClick={() => void handleSubmit('reject_with_feedback')}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          驳回并回退
        </button>
        <button
          disabled={submitting}
          onClick={() => void handleSubmit('rerun_node')}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          重跑当前节点
        </button>
      </div>
    </div>
  )
}
