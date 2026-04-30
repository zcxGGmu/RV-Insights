<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, XCircle, AlertTriangle, MessageSquare, RefreshCw } from 'lucide-vue-next'
import type { ReviewVerdict, ReviewFinding } from '@/types'

const props = defineProps<{
  verdict: ReviewVerdict
}>()

const sortedFindings = computed(() => {
  const order: Record<string, number> = { critical: 0, major: 1, minor: 2, suggestion: 3 }
  return [...(props.verdict.findings ?? [])].sort(
    (a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4),
  )
})

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-yellow-100 text-yellow-700',
  suggestion: 'bg-blue-100 text-blue-700',
}

const categoryColor: Record<string, string> = {
  correctness: 'text-purple-600',
  security: 'text-red-600',
  style: 'text-sky-600',
  completeness: 'text-emerald-600',
  performance: 'text-amber-600',
}
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <component
            :is="verdict.approved ? CheckCircle2 : XCircle"
            class="w-4 h-4"
            :class="verdict.approved ? 'text-green-500' : 'text-red-500'"
          />
          <h3 class="text-sm font-semibold text-gray-700">Review Verdict</h3>
        </div>
        <div class="flex items-center gap-2">
          <span class="flex items-center gap-1 text-xs text-gray-500">
            <RefreshCw class="w-3 h-3" />Iter {{ verdict.iteration }}
          </span>
          <span
            class="text-xs font-medium px-2 py-0.5 rounded-full"
            :class="verdict.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
          >
            {{ verdict.approved ? 'Approved' : 'Rejected' }}
          </span>
        </div>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Summary -->
      <p class="text-sm text-gray-600">{{ verdict.summary }}</p>

      <!-- Model -->
      <div class="text-xs text-gray-400">
        Reviewed by {{ verdict.reviewer_model }}
      </div>

      <!-- Findings -->
      <div v-if="sortedFindings.length" class="space-y-3">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Findings ({{ sortedFindings.length }})
        </h4>
        <div
          v-for="(finding, i) in sortedFindings"
          :key="i"
          class="border border-gray-100 rounded-lg p-3 space-y-1.5"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="text-xs font-medium px-1.5 py-0.5 rounded"
              :class="severityColor[finding.severity] ?? 'bg-gray-100 text-gray-700'"
            >
              {{ finding.severity }}
            </span>
            <span
              class="text-xs"
              :class="categoryColor[finding.category] ?? 'text-gray-500'"
            >
              {{ finding.category }}
            </span>
            <span v-if="finding.file" class="text-xs font-mono text-gray-400">
              {{ finding.file }}<template v-if="finding.line">:{{ finding.line }}</template>
            </span>
          </div>
          <p class="text-sm text-gray-700">{{ finding.description }}</p>
          <div v-if="finding.suggestion" class="flex items-start gap-1.5 text-sm text-gray-500">
            <MessageSquare class="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{{ finding.suggestion }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
