<template>
  <span :class="badgeClasses">{{ statusLabel }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CaseStatus } from '@/types'

const props = defineProps<{ status: CaseStatus }>()
const status = computed(() => props.status)

const statusToColor: Record<CaseStatus, string> = {
  created: 'bg-gray-200 text-gray-800',
  exploring: 'bg-blue-500 text-white',
  pending_explore_review: 'bg-yellow-300 text-yellow-800',
  planning: 'bg-blue-500 text-white',
  pending_plan_review: 'bg-yellow-300 text-yellow-800',
  developing: 'bg-blue-500 text-white',
  reviewing: 'bg-blue-500 text-white',
  pending_code_review: 'bg-yellow-300 text-yellow-800',
  testing: 'bg-blue-500 text-white',
  pending_test_review: 'bg-yellow-300 text-yellow-800',
  completed: 'bg-green-500 text-white',
  abandoned: 'bg-red-600 text-white',
}

const badgeClasses = computed(() => `text-xs font-semibold px-2 py-1 rounded-full ${statusToColor[status.value]}`)
const statusLabel = computed(() => String(status.value).replace('_', ' '))
</script>

<style scoped>
</style>
