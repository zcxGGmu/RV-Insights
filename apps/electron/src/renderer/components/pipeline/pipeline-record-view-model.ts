import type { PipelineRecord } from '@rv-insights/shared'
import type { PipelineNodeKind } from '@rv-insights/shared'
import {
  PIPELINE_NODE_ORDER,
  getPipelineNodeLabel,
  getPipelineStatusDisplay,
} from './pipeline-display-model'

export interface PipelineRecordViewModel {
  badge: string
  title: string
  summary?: string
  details?: string
  bullets?: string[]
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'
}

export interface PipelineRecordGroup {
  id: PipelineNodeKind | 'task'
  title: string
  records: PipelineRecord[]
}

type PipelineArtifactRecord = Extract<PipelineRecord, {
  type: 'user_input' | 'node_output' | 'review_result'
}>

function formatGateAction(action: string): string {
  switch (action) {
    case 'approve':
      return '通过'
    case 'reject_with_feedback':
      return '驳回并回退'
    case 'rerun_node':
      return '重跑当前节点'
    default:
      return action
  }
}

export function buildPipelineRecordViewModel(record: PipelineRecord): PipelineRecordViewModel {
  switch (record.type) {
    case 'user_input':
      return {
        badge: '任务',
        title: '用户任务',
        summary: record.content,
        tone: 'accent',
      }
    case 'node_transition':
      return {
        badge: '流程',
        title: `进入${getPipelineNodeLabel(record.toNode)}节点`,
        summary: record.fromNode ? `从${getPipelineNodeLabel(record.fromNode)}切换` : '开始执行该阶段',
        tone: 'neutral',
      }
    case 'node_output':
      return {
        badge: getPipelineNodeLabel(record.node),
        title: `${getPipelineNodeLabel(record.node)}输出`,
        summary: record.summary ?? record.content,
        details: record.summary && record.summary !== record.content ? record.content : undefined,
        tone: 'neutral',
      }
    case 'review_result':
      return {
        badge: '审查结论',
        title: record.approved ? '审查通过' : '审查需要修改',
        summary: record.summary,
        bullets: record.issues,
        tone: record.approved ? 'success' : 'warning',
      }
    case 'gate_requested':
      return {
        badge: '人工审核',
        title: `等待人工审核：${getPipelineNodeLabel(record.node)}`,
        summary: record.summary ?? '等待人工确认后继续',
        tone: 'warning',
      }
    case 'gate_decision':
      return {
        badge: '审核结果',
        title: `${getPipelineNodeLabel(record.node)}审核结果：${formatGateAction(record.action)}`,
        summary: record.feedback,
        tone: record.action === 'approve' ? 'success' : 'warning',
      }
    case 'status_change': {
      const statusDisplay = getPipelineStatusDisplay(record.status)
      return {
        badge: '状态',
        title: `状态切换为${statusDisplay.label}`,
        summary: record.reason,
        tone: record.status === 'completed' ? 'success' : record.status === 'terminated' || record.status === 'node_failed' ? 'warning' : 'neutral',
      }
    }
    case 'error':
      return {
        badge: '错误',
        title: record.node ? `${getPipelineNodeLabel(record.node)}执行失败` : 'Pipeline 执行失败',
        summary: record.error,
        tone: 'danger',
      }
  }
}

function findGroup(groups: PipelineRecordGroup[], id: PipelineRecordGroup['id']): PipelineRecordGroup | undefined {
  return groups.find((group) => group.id === id)
}

function ensureGroup(
  groups: PipelineRecordGroup[],
  id: PipelineRecordGroup['id'],
  title: string,
): PipelineRecordGroup {
  const existing = findGroup(groups, id)
  if (existing) return existing

  const next: PipelineRecordGroup = {
    id,
    title,
    records: [],
  }
  groups.push(next)
  return next
}

function isArtifactRecord(record: PipelineRecord): record is PipelineArtifactRecord {
  return record.type === 'user_input'
    || record.type === 'node_output'
    || record.type === 'review_result'
}

function sortGroups(groups: PipelineRecordGroup[]): PipelineRecordGroup[] {
  const order = new Map<PipelineRecordGroup['id'], number>([
    ['task', -1],
    ...PIPELINE_NODE_ORDER.map((node, index) => [node, index] as const),
  ])

  return [...groups].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
}

export function buildPipelineRecordGroups(records: PipelineRecord[]): {
  artifacts: PipelineRecordGroup[]
  logs: PipelineRecord[]
} {
  const artifactGroups: PipelineRecordGroup[] = []
  const logs: PipelineRecord[] = []

  for (const record of records) {
    if (!isArtifactRecord(record)) {
      logs.push(record)
      continue
    }

    if (record.type === 'user_input') {
      ensureGroup(artifactGroups, 'task', '任务输入').records.push(record)
      continue
    }

    ensureGroup(artifactGroups, record.node, getPipelineNodeLabel(record.node)).records.push(record)
  }

  return {
    artifacts: sortGroups(artifactGroups),
    logs,
  }
}
