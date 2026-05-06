import * as React from 'react'
import type { PipelineRecord } from '@rv-insights/shared'

function renderRecord(record: PipelineRecord): React.ReactNode {
  switch (record.type) {
    case 'user_input':
      return record.content
    case 'node_output':
      return record.summary ?? record.content
    case 'gate_requested':
      return `等待审核：${record.node}`
    case 'gate_decision':
      return `${record.node} -> ${record.action}${record.feedback ? ` (${record.feedback})` : ''}`
    case 'node_transition':
      return `进入节点：${record.toNode}`
    case 'status_change':
      return `状态切换：${record.status}`
    case 'review_result':
      return `${record.approved ? '通过' : '驳回'}：${record.summary}`
    case 'error':
      return record.error
    default:
      return JSON.stringify(record)
  }
}

export function PipelineRecords({
  records,
}: {
  records: PipelineRecord[]
}): React.ReactElement {
  return (
    <div className="rounded-3xl bg-white/80 px-5 py-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Records</div>
      <div className="mt-3 space-y-3">
        {records.map((record) => (
          <div key={record.id} className="rounded-2xl bg-zinc-50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {record.type}
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {renderRecord(record)}
            </div>
          </div>
        ))}
        {records.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 px-4 py-6 text-center text-sm text-muted-foreground">
            暂无记录
          </div>
        ) : null}
      </div>
    </div>
  )
}
