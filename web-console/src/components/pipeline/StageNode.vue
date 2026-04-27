<template>
  <div class="flex items-start gap-3 relative">
    <!-- Vertical connector line (not on last node) -->
    <div class="flex flex-col items-center">
      <div
        class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
        :class="ringClasses"
      >
        <component :is="statusIcon" class="w-4 h-4" :class="iconClasses" />
      </div>
      <div
        v-if="!isLast"
        class="w-0.5 h-8 mt-1"
        :class="connectorClasses"
      />
    </div>

    <!-- Label + meta -->
    <div class="pt-1 min-w-0">
      <p class="text-sm font-medium" :class="labelClasses">{{ stage.label }}</p>
      <p v-if="stage.status === 'waiting_review'" class="text-xs text-yellow-600 mt-0.5">
        Awaiting review
      </p>
      <p v-if="stage.completedAt" class="text-xs text-gray-400 mt-0.5">
        {{ formatDuration(stage.startedAt, stage.completedAt) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Circle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-vue-next'
import type { PipelineStage, StageStatus } from '@/types'

// Props are destructured so the template can reference `stage`, `isLast`, `isCurrent` directly.
const { stage, isCurrent, isLast } = defineProps<{
  stage: PipelineStage
  isCurrent: boolean
  isLast: boolean
}>()

type IconComponent = typeof Circle | typeof Loader2 | typeof CheckCircle2 | typeof XCircle | typeof Clock
const statusIcon = computed(() => {
  const icons: Record<StageStatus, IconComponent> = {
    pending: Circle,
    running: Loader2,
    completed: CheckCircle2,
    failed: XCircle,
    waiting_review: Clock,
  }
  return icons[stage.status] ?? Circle
})

const ringClasses = computed(() => {
  const base: Record<StageStatus, string> = {
    pending: 'bg-gray-100 border-2 border-gray-300',
    running: 'bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-200 animate-pulse',
    completed: 'bg-green-50 border-2 border-green-500',
    failed: 'bg-red-50 border-2 border-red-500',
    waiting_review: 'bg-yellow-50 border-2 border-yellow-400 ring-2 ring-yellow-200 animate-pulse',
  }
  return base[stage.status] ?? 'bg-gray-100 border-2 border-gray-300'
})

const iconClasses = computed(() => {
  const base: Record<StageStatus, string> = {
    pending: 'text-gray-400',
    running: 'text-blue-500 animate-spin',
    completed: 'text-green-500',
    failed: 'text-red-500',
    waiting_review: 'text-yellow-500',
  }
  return base[stage.status] ?? 'text-gray-400'
})

const connectorClasses = computed(() => {
  if (stage.status === 'completed') return 'bg-green-400'
  if (stage.status === 'running' || stage.status === 'waiting_review') return 'bg-blue-300'
  return 'bg-gray-200'
})

const labelClasses = computed(() => {
  if (stage.status === 'completed') return 'text-green-700'
  if (stage.status === 'running') return 'text-blue-700'
  if (stage.status === 'waiting_review') return 'text-yellow-700'
  if (stage.status === 'failed') return 'text-red-700'
  return 'text-gray-500'
})

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return ''
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return '<1s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
</script>
