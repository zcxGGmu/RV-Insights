import type { PipelineRecord } from '@rv-insights/shared'

export interface PipelineRecordViewModel {
  badge: string
  title: string
  summary?: string
  details?: string
  bullets?: string[]
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'
}

function formatNodeLabel(node: string): string {
  return node.toUpperCase()
}

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
        badge: 'USER_INPUT',
        title: '用户任务',
        summary: record.content,
        tone: 'accent',
      }
    case 'node_transition':
      return {
        badge: 'NODE_TRANSITION',
        title: `进入节点 ${formatNodeLabel(record.toNode)}`,
        summary: record.fromNode ? `从 ${formatNodeLabel(record.fromNode)} 切换` : '开始执行该阶段',
        tone: 'neutral',
      }
    case 'node_output':
      return {
        badge: formatNodeLabel(record.node),
        title: `${formatNodeLabel(record.node)} 输出`,
        summary: record.summary ?? record.content,
        details: record.summary && record.summary !== record.content ? record.content : undefined,
        tone: 'neutral',
      }
    case 'review_result':
      return {
        badge: 'REVIEW',
        title: record.approved ? 'Reviewer 通过' : 'Reviewer 需要修改',
        summary: record.summary,
        bullets: record.issues,
        tone: record.approved ? 'success' : 'warning',
      }
    case 'gate_requested':
      return {
        badge: 'HUMAN_GATE',
        title: `等待人工审核：${formatNodeLabel(record.node)}`,
        summary: record.summary ?? '等待人工确认后继续',
        tone: 'warning',
      }
    case 'gate_decision':
      return {
        badge: 'GATE_DECISION',
        title: `${formatNodeLabel(record.node)} 审核结果：${formatGateAction(record.action)}`,
        summary: record.feedback,
        tone: record.action === 'approve' ? 'success' : 'warning',
      }
    case 'status_change':
      return {
        badge: 'STATUS',
        title: `状态切换为 ${record.status}`,
        summary: record.reason,
        tone: record.status === 'completed' ? 'success' : record.status === 'terminated' || record.status === 'node_failed' ? 'warning' : 'neutral',
      }
    case 'error':
      return {
        badge: 'ERROR',
        title: record.node ? `${formatNodeLabel(record.node)} 执行失败` : 'Pipeline 执行失败',
        summary: record.error,
        tone: 'danger',
      }
  }
}
