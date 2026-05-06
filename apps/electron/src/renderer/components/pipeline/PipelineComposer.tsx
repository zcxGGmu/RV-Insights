import * as React from 'react'

export function PipelineComposer({
  disabled,
  onSubmit,
  onStop,
}: {
  disabled: boolean
  onSubmit: (input: string) => Promise<void>
  onStop: () => Promise<void>
}): React.ReactElement {
  const [value, setValue] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (): Promise<void> => {
    const input = value.trim()
    if (!input) return
    setSubmitting(true)
    try {
      await onSubmit(input)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-3xl bg-white/85 px-5 py-4 shadow-sm">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入要交给 RV Pipeline 的任务"
        className="min-h-28 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none"
      />
      <div className="mt-3 flex gap-2">
        <button
          disabled={disabled || submitting}
          onClick={() => void handleSubmit()}
          className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          启动 Pipeline
        </button>
        <button
          disabled={!disabled}
          onClick={() => void onStop()}
          className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          停止
        </button>
      </div>
    </div>
  )
}
