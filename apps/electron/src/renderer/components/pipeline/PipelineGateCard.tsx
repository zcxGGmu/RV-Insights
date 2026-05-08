import * as React from 'react'
import type { PipelineGateRequest } from '@rv-insights/shared'
import { buildPipelineGateViewModel } from './pipeline-display-model'

export function PipelineGateCard({
  request,
  onRespond,
}: {
  request: PipelineGateRequest
  onRespond: (action: 'approve' | 'reject_with_feedback' | 'rerun_node', feedback?: string) => Promise<void>
}): React.ReactElement {
  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submittedGateId, setSubmittedGateId] = React.useState<string | null>(null)
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const viewModel = buildPipelineGateViewModel(request)
  const locked = submitting || submittedGateId === request.gateId

  React.useEffect(() => {
    setSubmittedGateId(null)
    setSubmitting(false)
    setSubmitError(null)
    setFeedbackError(null)
  }, [request.gateId])

  const handleSubmit = async (
    action: 'approve' | 'reject_with_feedback' | 'rerun_node',
  ): Promise<void> => {
    if (locked) return

    const trimmedFeedback = feedback.trim()
    if (action === 'reject_with_feedback' && viewModel.rejectRequiresFeedback && !trimmedFeedback) {
      setFeedbackError('请填写需要修改的具体反馈。')
      return
    }

    setSubmitting(true)
    setFeedbackError(null)
    setSubmitError(null)
    try {
      await onRespond(action, trimmedFeedback || undefined)
      setSubmittedGateId(request.gateId)
      if (action !== 'approve') {
        setFeedback('')
      }
    } catch (error) {
      console.error('[PipelineGateCard] 响应审核失败:', error)
      setSubmitError(error instanceof Error ? error.message : '提交审核失败，请稍后重试。')
      setSubmittedGateId(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card px-4 py-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            审核面板
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {viewModel.title}
          </div>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {viewModel.iterationLabel}
        </div>
      </div>
      {viewModel.summary ? (
        <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm leading-6 text-foreground">
          {viewModel.summary}
        </p>
      ) : null}
      <label htmlFor={`pipeline-gate-feedback-${request.gateId}`} className="mt-4 block text-xs font-medium text-muted-foreground">
        反馈
      </label>
      <textarea
        id={`pipeline-gate-feedback-${request.gateId}`}
        value={feedback}
        onChange={(event) => {
          setFeedback(event.target.value)
          if (feedbackError) setFeedbackError(null)
          if (submitError) setSubmitError(null)
        }}
        placeholder={viewModel.feedbackPlaceholder}
        className="mt-2 min-h-24 w-full rounded-xl border bg-background px-3 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
      />
      {feedbackError ? (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">
          {feedbackError}
        </div>
      ) : null}
      {submitError ? (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">
          {submitError}
        </div>
      ) : null}
      {submittedGateId === request.gateId ? (
        <div className="mt-2 text-xs text-muted-foreground">
          已提交审核响应，正在等待 Pipeline 恢复。
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={locked}
          onClick={() => void handleSubmit('approve')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {locked ? '处理中' : viewModel.approveLabel}
        </button>
        <button
          disabled={locked}
          onClick={() => void handleSubmit('reject_with_feedback')}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {viewModel.rejectLabel}
        </button>
        <button
          disabled={locked}
          onClick={() => void handleSubmit('rerun_node')}
          className="rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          {viewModel.rerunLabel}
        </button>
      </div>
    </div>
  )
}
