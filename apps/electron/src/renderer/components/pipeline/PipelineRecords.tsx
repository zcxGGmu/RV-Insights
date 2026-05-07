import * as React from 'react'
import type { PipelineNodeKind, PipelineRecord } from '@rv-insights/shared'
import { Loader2 } from 'lucide-react'
import { MessageResponse } from '@/components/ai-elements/message'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPipelineNodeLabel } from './pipeline-display-model'
import {
  buildPipelineRecordGroups,
  buildPipelineRecordViewModel,
  type PipelineRecordGroup,
} from './pipeline-record-view-model'

const TONE_CLASS_MAP = {
  neutral: 'border-border bg-card text-card-foreground',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  danger: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
  accent: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
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
    <article className={`rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium opacity-70">
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
        <div className="mt-1 whitespace-pre-wrap text-sm leading-6 opacity-90">
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
            className="rounded-lg bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-background"
          >
            {expanded ? '收起全文' : '展开全文'}
          </button>
          {expanded ? (
            <MessageResponse className="mt-3 rounded-xl bg-background/80 px-4 py-3 text-sm leading-6">
              {viewModel.details ?? ''}
            </MessageResponse>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function RecordGroupSection({
  group,
}: {
  group: PipelineRecordGroup
}): React.ReactElement {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{group.records.length}</span>
      </div>
      <div className="space-y-2">
        {group.records.map((record) => (
          <RecordCard key={record.id} record={record} />
        ))}
      </div>
    </section>
  )
}

function LiveOutputPanel({
  node,
  output,
}: {
  node: PipelineNodeKind
  output: string
}): React.ReactElement {
  const nodeLabel = getPipelineNodeLabel(node)

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sky-950 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium tracking-[0.18em] opacity-70">实时输出</div>
          <h3 className="mt-1 text-sm font-semibold">{nodeLabel}节点正在输出</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-200">
          <Loader2 size={13} className="animate-spin" />
          运行中
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-background/80 px-3 py-3">
        {output ? (
          <MessageResponse className="text-sm">
            {output}
          </MessageResponse>
        ) : (
          <div className="text-sm text-muted-foreground">正在等待节点输出...</div>
        )}
      </div>
    </section>
  )
}

export function PipelineRecords({
  records,
  liveNode,
  liveOutput,
  showLiveOutput,
}: {
  records: PipelineRecord[]
  liveNode?: PipelineNodeKind
  liveOutput?: string
  showLiveOutput?: boolean
}): React.ReactElement {
  const groups = React.useMemo(() => buildPipelineRecordGroups(records), [records])

  return (
    <section className="space-y-3">
      {showLiveOutput && liveNode ? (
        <LiveOutputPanel node={liveNode} output={liveOutput ?? ''} />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground">阶段记录</div>
          <h2 className="mt-1 text-lg font-semibold text-foreground">阶段产物</h2>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">{records.length} 条记录</div>
      </div>

      <Tabs defaultValue="artifacts">
        <TabsList>
          <TabsTrigger value="artifacts">阶段产物</TabsTrigger>
          <TabsTrigger value="logs">运行日志</TabsTrigger>
        </TabsList>
        <TabsContent value="artifacts" className="mt-3 space-y-4">
          {groups.artifacts.map((group) => (
            <RecordGroupSection key={group.id} group={group} />
          ))}
          {groups.artifacts.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              暂无阶段产物
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="logs" className="mt-3 space-y-2">
          {groups.logs.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
          {groups.logs.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              暂无运行日志
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  )
}
