import * as React from 'react'
import type { PipelineRecord } from '@rv-insights/shared'
import { buildPipelineRecordViewModel } from './pipeline-record-view-model'

const TONE_CLASS_MAP = {
  neutral: 'border-zinc-200 bg-zinc-50 text-zinc-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  danger: 'border-rose-200 bg-rose-50 text-rose-950',
  accent: 'border-sky-200 bg-sky-50 text-sky-950',
} as const

function RecordCard({
  record,
}: {
  record: PipelineRecord
}): React.ReactElement {
  const viewModel = buildPipelineRecordViewModel(record)
  const [expanded, setExpanded] = React.useState(false)
  const toneClass = TONE_CLASS_MAP[viewModel.tone]
  const hasDetails = Boolean(viewModel.details)

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">
          {viewModel.badge}
        </div>
        <div className="text-[11px] opacity-50">
          {new Date(record.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })}
        </div>
      </div>

      <div className="mt-2 text-sm font-semibold">
        {viewModel.title}
      </div>

      {viewModel.summary ? (
        <div className="mt-1 whitespace-pre-wrap text-sm opacity-90">
          {viewModel.summary}
        </div>
      ) : null}

      {viewModel.bullets?.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm opacity-90">
          {viewModel.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {hasDetails ? (
        <div className="mt-3">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-xl bg-white/70 px-3 py-1.5 text-xs font-medium shadow-sm"
          >
            {expanded ? '收起全文' : '展开全文'}
          </button>
          {expanded ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white/70 px-4 py-3 text-sm leading-6 text-zinc-900">
              {viewModel.details}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function PipelineRecords({
  records,
}: {
  records: PipelineRecord[]
}): React.ReactElement {
  return (
    <div className="rounded-3xl border border-amber-100 bg-white px-5 py-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Records</div>
      <div className="mt-3 space-y-3">
        {records.map((record) => (
          <RecordCard key={record.id} record={record} />
        ))}
        {records.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            暂无记录
          </div>
        ) : null}
      </div>
    </div>
  )
}
