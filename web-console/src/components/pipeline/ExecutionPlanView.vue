<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-5">
    <!-- Summary bar -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-1.5 text-sm text-gray-700">
        <ListOrdered class="w-4 h-4 text-gray-400" />
        <span class="font-medium">{{ plan.dev_steps.length }} steps</span>
      </div>
      <div class="flex items-center gap-1.5 text-sm text-gray-700">
        <TestTube class="w-4 h-4 text-gray-400" />
        <span class="font-medium">{{ plan.test_cases.length }} tests</span>
      </div>
      <span
        class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        :class="riskBadgeClasses"
      >
        <AlertTriangle class="w-3 h-3" />
        {{ plan.risk_assessment }}
      </span>
    </div>

    <!-- Dev steps -->
    <div class="space-y-3">
      <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide">Development Steps</h4>
      <div
        v-for="step in plan.dev_steps"
        :key="step.id"
        class="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-2"
      >
        <div class="flex items-start gap-2">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-blue-100 text-blue-700 shrink-0">
            {{ step.id }}
          </span>
          <p class="text-sm text-gray-800">{{ step.description }}</p>
        </div>

        <!-- Target files as pills -->
        <div v-if="step.target_files.length > 0" class="flex flex-wrap gap-1">
          <span
            v-for="file in step.target_files"
            :key="file"
            class="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 truncate max-w-[200px]"
          >
            {{ file }}
          </span>
        </div>

        <p class="text-xs text-gray-600">{{ step.expected_changes }}</p>

        <div class="flex items-center gap-3 text-xs">
          <span
            class="px-1.5 py-0.5 rounded-full font-medium"
            :class="stepRiskClasses(step.risk_level)"
          >
            {{ step.risk_level }}
          </span>
          <span v-if="step.dependencies.length > 0" class="text-gray-500">
            Depends on: {{ step.dependencies.join(', ') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Test cases -->
    <div v-if="plan.test_cases.length > 0" class="space-y-3">
      <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide">Test Cases</h4>
      <div
        v-for="tc in plan.test_cases"
        :key="tc.id"
        class="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-1.5"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-mono text-gray-400">{{ tc.id }}</span>
          <span class="text-sm font-medium text-gray-800">{{ tc.name }}</span>
          <span
            class="px-1.5 py-0.5 rounded-full text-xs font-medium"
            :class="testTypeBadgeClasses(tc.type)"
          >
            {{ tc.type }}
          </span>
          <span
            v-if="tc.qemu_required"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700"
          >
            <Server class="w-3 h-3" />
            QEMU
          </span>
        </div>
        <p class="text-xs text-gray-600">{{ tc.description }}</p>
      </div>
    </div>

    <!-- Token estimate footer -->
    <div class="pt-2 border-t border-gray-100 text-xs text-gray-400 text-right">
      Estimated tokens: {{ plan.estimated_tokens.toLocaleString() }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ListOrdered,
  TestTube,
  AlertTriangle,
  Server,
} from 'lucide-vue-next'
import type { ExecutionPlan } from '@/types'

const props = defineProps<{
  plan: ExecutionPlan
}>()

const riskColorMap: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

const riskBadgeClasses = computed(() => {
  return riskColorMap[props.plan.risk_assessment] ?? 'bg-gray-100 text-gray-700'
})

function stepRiskClasses(level: string): string {
  return riskColorMap[level] ?? 'bg-gray-100 text-gray-600'
}

function testTypeBadgeClasses(type: string): string {
  const map: Record<string, string> = {
    unit: 'bg-blue-100 text-blue-700',
    integration: 'bg-purple-100 text-purple-700',
    regression: 'bg-orange-100 text-orange-700',
    e2e: 'bg-teal-100 text-teal-700',
  }
  return map[type] ?? 'bg-gray-100 text-gray-600'
}
</script>
