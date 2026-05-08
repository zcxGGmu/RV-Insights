import * as React from 'react'
import { AlertTriangle, Copy, FolderOpen, LocateFixed, RefreshCw, Settings2 } from 'lucide-react'
import type { PipelineFailureViewModel } from './pipeline-display-model'

function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const success = document.execCommand('copy')
    if (!success) {
      throw new Error('复制命令未成功执行')
    }
    return Promise.resolve()
  } finally {
    document.body.removeChild(textarea)
  }
}

export function PipelineFailureCard({
  canLocateError,
  viewModel,
  canRestart,
  onLocateError,
  onOpenArtifactsDir,
  onRestart,
  onOpenSettings,
}: {
  canLocateError: boolean
  viewModel: PipelineFailureViewModel
  canRestart: boolean
  onLocateError: () => void
  onOpenArtifactsDir: () => Promise<void> | void
  onRestart: () => void
  onOpenSettings: () => void
}): React.ReactElement {
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle')
  const [artifactStatus, setArtifactStatus] = React.useState<'idle' | 'failed'>('idle')

  const handleCopyError = React.useCallback(async (): Promise<void> => {
    try {
      await copyTextToClipboard(viewModel.message)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch (error) {
      console.error('[PipelineFailureCard] 复制错误失败:', error)
      setCopyStatus('failed')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    }
  }, [viewModel.message])

  const handleOpenArtifactsDir = React.useCallback(async (): Promise<void> => {
    try {
      setArtifactStatus('idle')
      await onOpenArtifactsDir()
    } catch (error) {
      console.error('[PipelineFailureCard] 打开产物目录失败:', error)
      setArtifactStatus('failed')
      window.setTimeout(() => setArtifactStatus('idle'), 2200)
    }
  }, [onOpenArtifactsDir])

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
            disabled={!canLocateError}
            onClick={onLocateError}
            className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-background/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LocateFixed size={15} />
            {viewModel.locateErrorLabel}
          </button>
          <button
            onClick={() => void handleCopyError()}
            className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-background/80"
          >
            <Copy size={15} />
            {copyStatus === 'copied' ? '已复制' : copyStatus === 'failed' ? '复制失败' : viewModel.copyErrorLabel}
          </button>
          <button
            onClick={() => void handleOpenArtifactsDir()}
            className="inline-flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-background/80"
          >
            <FolderOpen size={15} />
            {artifactStatus === 'failed' ? '打开失败' : viewModel.artifactsLabel}
          </button>
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
