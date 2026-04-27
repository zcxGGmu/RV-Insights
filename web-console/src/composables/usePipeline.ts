import { computed, type Ref } from 'vue'
import type { Case, PipelineStage, StageStatus, CaseStatus } from '@/types'

// Simple static stage definitions for visualization
const STAGE_DEFS = [
  { id: 'explore', label: 'Explore' },
  { id: 'plan', label: 'Plan' },
  { id: 'develop', label: 'Develop' },
  { id: 'review', label: 'Review' },
  { id: 'test', label: 'Test' },
] as const

type StageId = typeof STAGE_DEFS[number]['id'] extends infer U ? U & string : string

const STATUS_ORDER: CaseStatus[] = [
  'created', 'exploring', 'pending_explore_review',
  'planning', 'pending_plan_review',
  'developing', 'reviewing', 'pending_code_review',
  'testing', 'pending_test_review',
  'completed', 'abandoned',
]

const STAGE_RANGES: Record<string, [number, number]> = {
  explore: [1, 2],
  plan:    [3, 4],
  develop: [5, 5],
  review:  [6, 7],
  test:    [8, 9],
}

function statusIndex(status: CaseStatus): number {
  const idx = STATUS_ORDER.indexOf(status)
  return idx >= 0 ? idx : 0
}

function deriveStageStatus(caseStatus: CaseStatus, stageId: string): StageStatus {
  if (caseStatus === 'abandoned') return 'failed'
  const idx = statusIndex(caseStatus)
  const range = STAGE_RANGES[stageId]
  if (!range) return 'pending'
  const [start, end] = range
  if (idx < start) return 'pending'
  if (idx >= start && idx <= end) {
    return caseStatus.startsWith('pending_') ? 'waiting_review' : 'running'
  }
  return 'completed'
}

export function usePipeline(caseItem: Ref<Case | null>) {
  const stages = computed<PipelineStage[]>(() => {
    const status = caseItem.value?.status
    return STAGE_DEFS.map(({ id, label }) => ({
      id,
      label,
      status: status ? deriveStageStatus(status, id) : 'pending' as StageStatus,
    }))
  })

  const currentStage = computed<string | null>(() => {
    const s = caseItem.value?.status
    if (!s) return null
    const idx = statusIndex(s)
    for (const [stageId, [start, end]] of Object.entries(STAGE_RANGES)) {
      if (idx >= start && idx <= end) return stageId
    }
    if (s === 'completed' || s === 'abandoned') return 'test'
    return null
  })

  const isWaitingReview = computed<boolean>(() => {
    const s = caseItem.value?.status
    return !!s && s.startsWith('pending_')
  })

  const reviewIteration = computed<number>(() => {
    return caseItem.value?.review_iterations ?? 0
  })

  return { stages, currentStage, isWaitingReview, reviewIteration }
}
