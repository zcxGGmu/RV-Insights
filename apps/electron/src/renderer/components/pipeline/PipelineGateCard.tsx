import * as React from 'react'
import type { PipelineGateRequest } from '@rv-insights/shared'

export function PipelineGateCard({
  request,
  onRespond,
}: {
  request: PipelineGateRequest
  onRespond: (action: 'approve' | 'reject_with_feedback' | 'rerun_node', feedback?: string) => Promise<void>
}): React.ReactElement {
  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

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
    <div className="rounded-3xl bg-amber-50 px-5 py-4 shadow-sm">
      <div className="text-sm font-medium text-amber-900">
        等待人工审核：{request.node}
      </div>
      {request.summary ? (
        <p className="mt-2 text-sm text-amber-900/80">{request.summary}</p>
      ) : null}
      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder={request.feedbackHint ?? '可选反馈'}
        className="mt-3 min-h-24 w-full rounded-2xl border border-amber-200 bg-white px-3 py-3 text-sm outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={submitting}
          onClick={() => void handleSubmit('approve')}
          className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          通过
        </button>
        <button
          disabled={submitting}
          onClick={() => void handleSubmit('reject_with_feedback')}
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          驳回并回退
        </button>
        <button
          disabled={submitting}
          onClick={() => void handleSubmit('rerun_node')}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm disabled:opacity-50"
        >
          重跑当前节点
        </button>
      </div>
    </div>
  )
}
