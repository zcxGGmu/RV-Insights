<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, XCircle, AlertTriangle, Cpu, FlaskConical } from 'lucide-vue-next'
import type { TestResult } from '@/types'

const props = defineProps<{
  result: TestResult
}>()

const passRate = computed(() => {
  if (props.result.total_tests === 0) return null
  return Math.round((props.result.passed_tests / props.result.total_tests) * 100)
})

const compilationLabel = computed(() => {
  if (props.result.compilation_passed == null) return null
  return props.result.compilation_passed ? 'Compilation passed' : 'Compilation failed'
})
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FlaskConical class="w-4 h-4 text-gray-500" />
          <h3 class="text-sm font-semibold text-gray-700">Test Result</h3>
        </div>
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full"
          :class="result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
        >
          {{ result.passed ? 'Passed' : 'Failed' }}
        </span>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Stats row -->
      <div class="flex items-center gap-4 text-sm">
        <span class="flex items-center gap-1 text-green-600">
          <CheckCircle2 class="w-3.5 h-3.5" />{{ result.passed_tests }} passed
        </span>
        <span v-if="result.failed_tests > 0" class="flex items-center gap-1 text-red-600">
          <XCircle class="w-3.5 h-3.5" />{{ result.failed_tests }} failed
        </span>
        <span class="text-gray-500">{{ result.total_tests }} total</span>
        <span v-if="passRate != null" class="text-gray-400">{{ passRate }}%</span>
      </div>

      <!-- Compilation status -->
      <div v-if="compilationLabel" class="flex items-center gap-2 text-sm">
        <Cpu class="w-3.5 h-3.5" :class="result.compilation_passed ? 'text-green-500' : 'text-red-500'" />
        <span :class="result.compilation_passed ? 'text-green-600' : 'text-red-600'">
          {{ compilationLabel }}
        </span>
      </div>

      <!-- QEMU version -->
      <div v-if="result.qemu_version" class="text-xs text-gray-400">
        QEMU {{ result.qemu_version }}
      </div>

      <!-- Test case results -->
      <div v-if="result.test_case_results?.length" class="space-y-2">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Test Cases ({{ result.test_case_results.length }})
        </h4>
        <div
          v-for="tc in result.test_case_results"
          :key="tc.test_id"
          class="flex items-start gap-2 border border-gray-100 rounded-lg px-3 py-2"
        >
          <component
            :is="tc.passed ? CheckCircle2 : XCircle"
            class="w-3.5 h-3.5 mt-0.5 shrink-0"
            :class="tc.passed ? 'text-green-500' : 'text-red-500'"
          />
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-700 truncate">{{ tc.name }}</div>
            <div class="text-xs text-gray-500">{{ tc.message }}</div>
          </div>
        </div>
      </div>

      <!-- Failure details -->
      <div v-if="result.failure_details?.length" class="space-y-2">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Failure Details
        </h4>
        <div
          v-for="(detail, i) in result.failure_details"
          :key="i"
          class="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2"
        >
          <AlertTriangle class="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
          <span>{{ detail }}</span>
        </div>
      </div>

      <!-- Test log (collapsible) -->
      <details v-if="result.test_log" class="text-sm">
        <summary class="cursor-pointer text-gray-500 hover:text-gray-700">View test log</summary>
        <pre class="mt-2 bg-gray-50 rounded p-3 text-xs text-gray-600 overflow-x-auto max-h-60 whitespace-pre-wrap">{{ result.test_log }}</pre>
      </details>
    </div>
  </div>
</template>
