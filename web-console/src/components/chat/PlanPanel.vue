<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle, Circle, Loader2, ChevronDown, ChevronRight } from 'lucide-vue-next'

export interface PlanStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

const props = defineProps<{
  steps: PlanStep[]
  collapsed?: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const progress = computed(() => {
  if (!props.steps.length) return 0
  const done = props.steps.filter((s) => s.status === 'done').length
  return Math.round((done / props.steps.length) * 100)
})

const statusIcon = {
  pending: Circle,
  running: Loader2,
  done: CheckCircle,
  error: Circle,
}

const statusClass = {
  pending: 'text-gray-400',
  running: 'text-blue-500 animate-spin',
  done: 'text-green-500',
  error: 'text-red-500',
}
</script>

<template>
  <div v-if="steps.length" class="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
      @click="emit('toggle')"
    >
      <component :is="collapsed ? ChevronRight : ChevronDown" class="size-4" />
      <span>执行计划</span>
      <span class="ml-auto text-xs text-gray-500">{{ progress }}%</span>
    </button>

    <div v-if="!collapsed" class="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
      <div class="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-300"
          :style="{ width: `${progress}%` }"
        />
      </div>

      <ul class="space-y-1.5">
        <li
          v-for="step in steps"
          :key="step.id"
          class="flex items-start gap-2 text-sm"
        >
          <component
            :is="statusIcon[step.status]"
            class="mt-0.5 size-4 shrink-0"
            :class="statusClass[step.status]"
          />
          <div>
            <span class="text-gray-700 dark:text-gray-300">{{ step.label }}</span>
            <p v-if="step.detail" class="text-xs text-gray-500">{{ step.detail }}</p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
