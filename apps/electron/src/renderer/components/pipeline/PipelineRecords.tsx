import * as React from 'react'
import type { PipelineNodeKind, PipelineRecord } from '@rv-insights/shared'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clipboard,
  FolderOpen,
  GitCompareArrows,
  Loader2,
  Search,
} from 'lucide-react'
import { MessageResponse } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getPipelineNodeLabel,
  PIPELINE_NODE_ORDER,
} from './pipeline-display-model'
import {
  buildPipelineMarkdownReport,
  buildPipelineRecordSearchMatches,
  filterPipelineRecordGroups,
  filterPipelineRecords,
  slicePipelineRecordGroups,
  type PipelineRecordStageFilter,
  type PipelineRecordTab,
} from './pipeline-record-experience-model'
import {
  buildPipelineRecordGroups,
  buildPipelineRecordViewModel,
  type PipelineRecordGroup,
} from './pipeline-record-view-model'
import {
  buildPipelineReviewComparison,
  type PipelineReviewComparisonViewModel,
  type PipelineReviewRoundViewModel,
} from './pipeline-review-comparison-model'

const INITIAL_ARTIFACT_LIMIT = 60
const ARTIFACT_LOAD_STEP = 40
const INITIAL_LOG_LIMIT = 100
const LOG_LOAD_STEP = 100

const TONE_CLASS_MAP = {
  neutral: 'border-border bg-card text-card-foreground',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  danger: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
  accent: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
} as const

const REVIEW_TONE_CLASS_MAP = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
} as const

const STAGE_FILTERS: Array<{ value: PipelineRecordStageFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'task', label: '任务' },
  ...PIPELINE_NODE_ORDER.map((node) => ({
    value: node,
    label: getPipelineNodeLabel(node),
  })),
]

function formatRecordTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

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

const RecordCard = React.memo(function RecordCard({
  expanded,
  highlighted,
  onRegisterElement,
  onToggleExpanded,
  record,
}: {
  expanded: boolean
  highlighted: boolean
  onRegisterElement: (recordId: string, element: HTMLElement | null) => void
  onToggleExpanded: (recordId: string) => void
  record: PipelineRecord
}): React.ReactElement {
  const viewModel = React.useMemo(() => buildPipelineRecordViewModel(record), [record])
  const toneClass = TONE_CLASS_MAP[viewModel.tone]
  const hasDetails = Boolean(viewModel.details)
  const artifactFiles = viewModel.artifactFiles ?? []
  const [artifactOpenFailed, setArtifactOpenFailed] = React.useState(false)
  const artifactOpenTimer = React.useRef<number | null>(null)
  const registerElement = React.useCallback((element: HTMLElement | null) => {
    onRegisterElement(record.id, element)
  }, [onRegisterElement, record.id])
  React.useEffect(() => () => {
    if (artifactOpenTimer.current !== null) {
      window.clearTimeout(artifactOpenTimer.current)
    }
  }, [])
  const openArtifactsDir = React.useCallback(async (): Promise<void> => {
    try {
      setArtifactOpenFailed(false)
      const opened = await window.electronAPI.openPipelineArtifactsDir(record.sessionId)
      if (!opened) {
        throw new Error('系统未能打开 Pipeline 产物目录')
      }
    } catch (error) {
      console.error('[PipelineRecords] 打开 Pipeline 产物目录失败:', error)
      setArtifactOpenFailed(true)
      if (artifactOpenTimer.current !== null) {
        window.clearTimeout(artifactOpenTimer.current)
      }
      artifactOpenTimer.current = window.setTimeout(() => setArtifactOpenFailed(false), 2200)
    }
  }, [record.sessionId])

  return (
    <article
      id={`pipeline-record-${record.id}`}
      ref={registerElement}
      className={`rounded-xl border px-4 py-3 shadow-sm transition-shadow ${toneClass} ${
        highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium opacity-70">
          {viewModel.badge}
        </div>
        <div className="text-[11px] opacity-50">
          {formatRecordTime(record.createdAt)}
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

      {artifactFiles.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium opacity-80">
            已落盘
          </span>
          {artifactFiles.map((file) => (
            <span
              key={file.relativePath}
              className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] opacity-70"
            >
              {file.displayName}
            </span>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openArtifactsDir}
            className="bg-background/80 hover:bg-background"
          >
            <FolderOpen size={15} />
            {artifactOpenFailed ? '打开失败' : '打开产物目录'}
          </Button>
        </div>
      ) : null}

      {hasDetails ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onToggleExpanded(record.id)}
            className="bg-background/80 hover:bg-background"
          >
            {expanded ? '收起全文' : '展开全文'}
          </Button>
          {expanded ? (
            <MessageResponse className="mt-3 rounded-xl bg-background/80 px-4 py-3 text-sm leading-6">
              {viewModel.details ?? ''}
            </MessageResponse>
          ) : null}
        </div>
      ) : null}
    </article>
  )
})

function RecordGroupSection({
  expandedRecordIds,
  group,
  highlightedRecordId,
  onRegisterElement,
  onToggleExpanded,
}: {
  expandedRecordIds: Set<string>
  group: PipelineRecordGroup
  highlightedRecordId?: string
  onRegisterElement: (recordId: string, element: HTMLElement | null) => void
  onToggleExpanded: (recordId: string) => void
}): React.ReactElement {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{group.records.length}</span>
      </div>
      <div className="space-y-2">
        {group.records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            expanded={expandedRecordIds.has(record.id)}
            highlighted={highlightedRecordId === record.id}
            onRegisterElement={onRegisterElement}
            onToggleExpanded={onToggleExpanded}
          />
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

function ReviewRoundRow({
  onFocusRecord,
  round,
}: {
  onFocusRecord: (recordId: string) => void
  round: PipelineReviewRoundViewModel
}): React.ReactElement {
  const toneClass = REVIEW_TONE_CLASS_MAP[round.tone]
  const Icon = round.approved ? CircleCheck : CircleAlert

  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClass}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon size={16} />
            <span className="text-sm font-semibold">{round.roundLabel}</span>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium">
              {round.statusLabel}
            </span>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium opacity-75">
              {round.modelStatusLabel}
            </span>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium">
              {round.issueCountLabel}
            </span>
          </div>
          <p className="mt-2 break-words text-sm leading-6 opacity-90 [overflow-wrap:anywhere]">{round.summary}</p>
          {round.issues.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 opacity-85">
              {round.issues.slice(0, 3).map((issue) => (
                <li key={issue} className="break-words [overflow-wrap:anywhere]">
                  {issue}
                </li>
              ))}
            </ul>
          ) : null}
          {round.feedback ? (
            <div className="mt-2 break-words rounded-lg bg-background/70 px-3 py-2 text-xs leading-5 [overflow-wrap:anywhere]">
              人工反馈：{round.feedback}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {round.decisionLabel ? (
            <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium">
              {round.decisionLabel}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`定位${round.roundLabel}审查记录`}
            onClick={() => onFocusRecord(round.sourceRecordId)}
          >
            定位记录
          </Button>
        </div>
      </div>
    </div>
  )
}

function PipelineReviewComparisonPanel({
  comparison,
  onFocusRecord,
}: {
  comparison: PipelineReviewComparisonViewModel
  onFocusRecord: (recordId: string) => void
}): React.ReactElement {
  const latestToneClass = REVIEW_TONE_CLASS_MAP[comparison.summary.latestTone]

  return (
    <section className="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground">
            <GitCompareArrows size={14} />
            REVIEW 对比
          </div>
          <h3 className="mt-1 text-base font-semibold text-foreground">多轮审查结论</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 font-medium ${latestToneClass}`}>
            {comparison.summary.latestStatusLabel}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            共 {comparison.summary.totalRounds} 轮
          </span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-200">
            通过 {comparison.summary.approvedRounds}
          </span>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-200">
            修改 {comparison.summary.rejectedRounds}
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {comparison.rounds.map((round) => (
          <ReviewRoundRow
            key={round.sourceRecordId}
            round={round}
            onFocusRecord={onFocusRecord}
          />
        ))}
      </div>
    </section>
  )
}

function EmptyRecordState({
  hasQuery,
  tab,
}: {
  hasQuery: boolean
  tab: PipelineRecordTab
}): React.ReactElement {
  const defaultText = tab === 'artifacts' ? '暂无阶段产物' : '暂无运行日志'
  return (
    <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      {hasQuery ? '没有匹配记录' : defaultText}
    </div>
  )
}

export function PipelineRecords({
  records,
  liveNode,
  liveOutput,
  sessionId,
  sessionTitle,
  showLiveOutput,
}: {
  records: PipelineRecord[]
  liveNode?: PipelineNodeKind
  liveOutput?: string
  sessionId: string
  sessionTitle?: string
  showLiveOutput?: boolean
}): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<PipelineRecordTab>('artifacts')
  const [stageFilter, setStageFilter] = React.useState<PipelineRecordStageFilter>('all')
  const [query, setQuery] = React.useState('')
  const [artifactLimit, setArtifactLimit] = React.useState(INITIAL_ARTIFACT_LIMIT)
  const [logLimit, setLogLimit] = React.useState(INITIAL_LOG_LIMIT)
  const [expandedRecordIds, setExpandedRecordIds] = React.useState<Set<string>>(new Set())
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0)
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle')
  const recordElements = React.useRef(new Map<string, HTMLElement>())
  const normalizedQuery = query.trim()

  const groups = React.useMemo(() => buildPipelineRecordGroups(records), [records])
  const filter = React.useMemo(() => ({
    stage: stageFilter,
    query,
  }), [query, stageFilter])
  const filteredArtifacts = React.useMemo(() =>
    filterPipelineRecordGroups(groups.artifacts, filter), [filter, groups.artifacts])
  const filteredLogs = React.useMemo(() =>
    filterPipelineRecords(groups.logs, filter), [filter, groups.logs])
  const visibleArtifacts = React.useMemo(() =>
    slicePipelineRecordGroups(filteredArtifacts, artifactLimit), [artifactLimit, filteredArtifacts])
  const visibleLogs = React.useMemo(() => {
    const startIndex = Math.max(0, filteredLogs.length - logLimit)
    return filteredLogs.slice(startIndex)
  }, [filteredLogs, logLimit])
  const hasMoreLogs = visibleLogs.length < filteredLogs.length
  const searchMatches = React.useMemo(() =>
    buildPipelineRecordSearchMatches(records, query), [query, records])
  const reviewComparison = React.useMemo(() =>
    buildPipelineReviewComparison(records), [records])
  const activeMatch = searchMatches[activeMatchIndex]

  React.useEffect(() => {
    setActiveTab('artifacts')
    setStageFilter('all')
    setQuery('')
    setArtifactLimit(INITIAL_ARTIFACT_LIMIT)
    setLogLimit(INITIAL_LOG_LIMIT)
    setExpandedRecordIds(new Set())
    setActiveMatchIndex(0)
    recordElements.current.clear()
  }, [sessionId])

  React.useEffect(() => {
    setActiveMatchIndex(0)
  }, [query])

  React.useEffect(() => {
    setActiveMatchIndex((prev) => {
      if (searchMatches.length === 0) return 0
      return Math.min(prev, searchMatches.length - 1)
    })
  }, [searchMatches.length])

  React.useEffect(() => {
    const recordIds = new Set(records.map((record) => record.id))
    setExpandedRecordIds((prev) => {
      const next = new Set([...prev].filter((id) => recordIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [records])

  const registerRecordElement = React.useCallback((recordId: string, element: HTMLElement | null): void => {
    if (element) {
      recordElements.current.set(recordId, element)
    } else {
      recordElements.current.delete(recordId)
    }
  }, [])

  const toggleExpanded = React.useCallback((recordId: string): void => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) {
        next.delete(recordId)
      } else {
        next.add(recordId)
      }
      return next
    })
  }, [])

  const scrollToRecord = React.useCallback((recordId: string): void => {
    window.requestAnimationFrame(() => {
      recordElements.current.get(recordId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }, [])

  const jumpToMatch = React.useCallback((nextIndex: number): void => {
    const match = searchMatches[nextIndex]
    if (!match) return

    setActiveMatchIndex(nextIndex)
    setActiveTab(match.tab)
    setStageFilter(match.stage)
    if (match.tab === 'artifacts') {
      setArtifactLimit(Math.max(records.length, INITIAL_ARTIFACT_LIMIT))
    } else {
      setLogLimit(Math.max(records.length, INITIAL_LOG_LIMIT))
    }
    scrollToRecord(match.recordId)
  }, [records.length, scrollToRecord, searchMatches])

  const focusReviewRecord = React.useCallback((recordId: string): void => {
    setActiveTab('artifacts')
    setStageFilter('reviewer')
    setArtifactLimit(Math.max(records.length, INITIAL_ARTIFACT_LIMIT))
    scrollToRecord(recordId)
  }, [records.length, scrollToRecord])

  const handleCopyReport = React.useCallback(async (): Promise<void> => {
    try {
      const report = buildPipelineMarkdownReport({
        title: sessionTitle ? `${sessionTitle} - Pipeline 报告` : 'Pipeline 会话报告',
        records,
        generatedAt: Date.now(),
      })
      await copyTextToClipboard(report)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch (error) {
      console.error('[PipelineRecords] 复制报告失败:', error)
      setCopyStatus('failed')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    }
  }, [records, sessionTitle])

  const handleTabChange = React.useCallback((value: string): void => {
    setActiveTab(value === 'logs' ? 'logs' : 'artifacts')
  }, [])

  const currentVisibleCount = activeTab === 'artifacts'
    ? visibleArtifacts.visibleCount
    : visibleLogs.length
  const currentTotalCount = activeTab === 'artifacts'
    ? visibleArtifacts.totalCount
    : filteredLogs.length
  const showReviewComparison = Boolean(activeTab === 'artifacts'
    && reviewComparison?.shouldShowPanel
    && !normalizedQuery
    && (stageFilter === 'all' || stageFilter === 'reviewer'))

  return (
    <section className="space-y-3">
      {showLiveOutput && liveNode ? (
        <LiveOutputPanel node={liveNode} output={liveOutput ?? ''} />
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground">阶段记录</div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">阶段产物</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{records.length} 条记录</span>
            <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:block" />
            <span className="tabular-nums">当前显示 {currentVisibleCount}/{currentTotalCount}</span>
            {searchMatches.length > 0 ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                命中 {searchMatches.length}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(220px,1fr)_auto]">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="搜索 Pipeline 记录"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索阶段产物、审核反馈或运行日志"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (searchMatches.length === 0) return
                const nextIndex = activeMatchIndex === 0 ? searchMatches.length - 1 : activeMatchIndex - 1
                jumpToMatch(nextIndex)
              }}
              disabled={searchMatches.length === 0}
              aria-label="跳转到上一个搜索结果"
            >
              <ChevronLeft size={15} />
              上一个
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (searchMatches.length === 0) return
                const nextIndex = activeMatchIndex >= searchMatches.length - 1 ? 0 : activeMatchIndex + 1
                jumpToMatch(nextIndex)
              }}
              disabled={searchMatches.length === 0}
              aria-label="跳转到下一个搜索结果"
            >
              下一个
              <ChevronRight size={15} />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyReport}
            >
              {copyStatus === 'copied' ? <Check size={15} /> : <Clipboard size={15} />}
              {copyStatus === 'copied' ? '已复制' : copyStatus === 'failed' ? '复制失败' : '复制报告'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="按阶段筛选记录">
          {STAGE_FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={stageFilter === item.value ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={stageFilter === item.value}
              onClick={() => setStageFilter(item.value)}
              className={stageFilter === item.value ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {activeMatch ? (
          <button
            type="button"
            onClick={() => jumpToMatch(activeMatchIndex)}
            className="rounded-xl bg-muted px-3 py-2 text-left text-xs leading-5 text-muted-foreground transition-colors hover:bg-muted/80"
          >
            <span className="font-medium text-foreground">
              {activeMatchIndex + 1}/{searchMatches.length} · {activeMatch.title}
            </span>
            <span className="ml-2">{activeMatch.snippet}</span>
          </button>
        ) : normalizedQuery ? (
          <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            未找到匹配内容
          </div>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="artifacts">阶段产物</TabsTrigger>
          <TabsTrigger value="logs">运行日志</TabsTrigger>
        </TabsList>

        <TabsContent value="artifacts" className="mt-3 space-y-4">
          {activeTab === 'artifacts' ? (
            <>
              {showReviewComparison && reviewComparison ? (
                <PipelineReviewComparisonPanel
                  comparison={reviewComparison}
                  onFocusRecord={focusReviewRecord}
                />
              ) : null}
              {visibleArtifacts.groups.map((group) => (
                <RecordGroupSection
                  key={group.id}
                  group={group}
                  expandedRecordIds={expandedRecordIds}
                  highlightedRecordId={activeMatch?.tab === 'artifacts' ? activeMatch.recordId : undefined}
                  onRegisterElement={registerRecordElement}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
              {visibleArtifacts.groups.length === 0 ? (
                <EmptyRecordState hasQuery={Boolean(normalizedQuery)} tab="artifacts" />
              ) : null}
              {visibleArtifacts.hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setArtifactLimit((prev) => prev + ARTIFACT_LOAD_STEP)}
                >
                  显示更多阶段产物
                </Button>
              ) : null}
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="logs" className="mt-3 space-y-2">
          {activeTab === 'logs' ? (
            <>
              {hasMoreLogs ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setLogLimit((prev) => prev + LOG_LOAD_STEP)}
                >
                  加载更早日志
                </Button>
              ) : null}
              {visibleLogs.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  expanded={expandedRecordIds.has(record.id)}
                  highlighted={activeMatch?.tab === 'logs' && activeMatch.recordId === record.id}
                  onRegisterElement={registerRecordElement}
                  onToggleExpanded={toggleExpanded}
                />
              ))}
              {visibleLogs.length === 0 ? (
                <EmptyRecordState hasQuery={Boolean(normalizedQuery)} tab="logs" />
              ) : null}
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  )
}
