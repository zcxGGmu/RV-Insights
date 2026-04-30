<script setup lang="ts">
import { computed } from 'vue'
import { PartyPopper, GitCommitHorizontal, DollarSign, Clock } from 'lucide-vue-next'
import type { Case } from '@/types'

const props = defineProps<{
  caseData: Case
}>()

const costDisplay = computed(() => {
  const cost = props.caseData.cost
  if (!cost) return null
  return `$${cost.estimated_cost_usd.toFixed(4)}`
})

const tokenDisplay = computed(() => {
  const cost = props.caseData.cost
  if (!cost) return null
  const total = cost.total_input_tokens + cost.total_output_tokens
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M tokens`
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}K tokens`
  return `${total} tokens`
})

const completedAt = computed(() => {
  if (!props.caseData.updated_at) return null
  return new Date(props.caseData.updated_at).toLocaleString()
})
</script>

<template>
  <div class="bg-white rounded-lg border border-green-200 overflow-hidden">
    <div class="px-4 py-3 border-b border-green-100 bg-green-50">
      <div class="flex items-center gap-2">
        <PartyPopper class="w-4 h-4 text-green-600" />
        <h3 class="text-sm font-semibold text-green-800">Pipeline Complete</h3>
      </div>
    </div>

    <div class="p-4 space-y-3">
      <!-- Commit message -->
      <div v-if="caseData.development_result?.commit_message" class="flex items-start gap-2">
        <GitCommitHorizontal class="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
        <span class="text-sm font-mono text-gray-700">{{ caseData.development_result.commit_message }}</span>
      </div>

      <!-- Cost -->
      <div v-if="costDisplay" class="flex items-center gap-2 text-sm">
        <DollarSign class="w-3.5 h-3.5 text-gray-400" />
        <span class="text-gray-600">{{ costDisplay }}</span>
        <span v-if="tokenDisplay" class="text-gray-400">({{ tokenDisplay }})</span>
      </div>

      <!-- Completed at -->
      <div v-if="completedAt" class="flex items-center gap-2 text-sm">
        <Clock class="w-3.5 h-3.5 text-gray-400" />
        <span class="text-gray-500">{{ completedAt }}</span>
      </div>

      <!-- Summary stats -->
      <div class="flex items-center gap-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
        <span v-if="caseData.review_iterations">{{ caseData.review_iterations }} review iteration{{ caseData.review_iterations > 1 ? 's' : '' }}</span>
        <span v-if="caseData.development_result">{{ caseData.development_result.changed_files?.length ?? 0 }} files changed</span>
        <span v-if="caseData.test_result?.passed" class="text-green-600">All tests passed</span>
      </div>
    </div>
  </div>
</template>
