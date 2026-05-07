import * as React from 'react'

export function PipelineComposer({
  disabled,
  currentTask,
  onSubmit,
  onStop,
}: {
  disabled: boolean
  currentTask?: string
  onSubmit: (input: string) => Promise<void>
  onStop: () => Promise<void>
}): React.ReactElement {
  const [value, setValue] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [stopping, setStopping] = React.useState(false)

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

  const handleStop = async (): Promise<void> => {
    setStopping(true)
    try {
      await onStop()
    } finally {
      setStopping(false)
    }
  }

  if (disabled) {
    return (
      <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">当前任务</div>
            <div className="mt-1 max-h-16 overflow-hidden text-sm leading-6 text-foreground">
              {currentTask || 'Pipeline 正在运行'}
            </div>
          </div>
          <button
            disabled={stopping}
            onClick={() => void handleStop()}
            className="flex-shrink-0 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            停止运行
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <label htmlFor="pipeline-task-input" className="text-sm font-medium text-foreground">
        Pipeline 任务
      </label>
      <textarea
        id="pipeline-task-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入要交给 RV Pipeline 的任务"
        className="mt-2 min-h-28 w-full resize-y rounded-xl border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary"
      />
      <div className="mt-3 flex gap-2">
        <button
          disabled={disabled || submitting}
          onClick={() => void handleSubmit()}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          启动 Pipeline
        </button>
      </div>
    </div>
  )
}
