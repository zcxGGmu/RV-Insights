<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white">
      <button @click="goBack" class="text-gray-500 hover:text-gray-700" aria-label="Back">
        <ArrowLeft class="w-5 h-5" />
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-semibold text-gray-900 truncate">{{ caseStore.currentCase?.title || '' }}</h1>
        <p class="text-sm text-gray-500 truncate" v-if="caseStore.currentCase?.target_repo">{{ caseStore.currentCase.target_repo }}</p>
      </div>
      <CaseStatusBadge v-if="caseStore.currentCase" :status="caseStore.currentCase.status" />
      <button
        v-if="caseStore.currentCase?.status === 'created'"
        @click="handleStart"
        :disabled="caseStore.isLoading"
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        Start Pipeline
      </button>
    </div>

    <!-- Three-column body -->
    <div class="flex flex-1 overflow-hidden flex-col md:flex-row">
      <!-- Left: Pipeline Visualization -->
      <aside class="w-full md:w-72 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Pipeline</h2>
        <div id="pipeline-slot" class="space-y-2">
          <div v-for="stage in pipelineStages" :key="stage.id" class="flex items-center gap-2 py-2">
            <span class="w-2 h-2 rounded-full" :class="stageColor(stage.status)" aria-label="stage-status"></span>
            <span class="text-sm">{{ stage.label }}</span>
            <span class="text-xs text-gray-400 ml-auto">{{ stage.status }}</span>
          </div>
        </div>
      </aside>

      <!-- Center: Event Log / Agent Output -->
      <main class="flex-1 overflow-y-auto p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Events</h2>
        <div v-if="caseEvents.events.value.length === 0" class="text-sm text-gray-400">
          No events yet. Start the pipeline to see activity.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="event in caseEvents.events.value"
            :key="event.seq"
            class="text-sm p-2 bg-white rounded border border-gray-100"
          >
            <span class="font-mono text-xs text-gray-400">#{{ event.seq }}</span>
            <span class="ml-2 font-medium">{{ event.event_type }}</span>
            <pre class="mt-1 text-xs text-gray-600 whitespace-pre-wrap">{{ JSON.stringify(event.data, null, 2) }}</pre>
          </div>
        </div>
      </main>

      <!-- Right: Review Panel / Metadata -->
      <aside class="w-full md:w-80 shrink-0 border-l border-gray-200 bg-gray-50 overflow-y-auto p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Details</h2>
        <div class="space-y-3 text-sm">
          <div>
            <span class="text-gray-500">Repository:</span>
            <span class="ml-2 font-medium">{{ caseStore.currentCase?.target_repo }}</span>
          </div>
          <div v-if="caseStore.currentCase?.contribution_type">
            <span class="text-gray-500">Type:</span>
            <span class="ml-2">{{ caseStore.currentCase.contribution_type }}</span>
          </div>
          <div v-if="caseStore.currentCase?.cost?.estimated_cost_usd != null">
            <span class="text-gray-500">Cost:</span>
            <span class="ml-2">${{ caseStore.currentCase.cost.estimated_cost_usd.toFixed(2) }}</span>
          </div>
          <div v-if="caseStore.currentCase?.created_at">
            <span class="text-gray-500">Created:</span>
            <span class="ml-2">{{ new Date(caseStore.currentCase.created_at).toLocaleString() }}</span>
          </div>
        </div>

        <!-- Review panel placeholder -->
        <div id="review-slot" class="mt-6">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Review</h2>
          <div v-if="pipeline.isWaitingReview.value" class="text-sm text-yellow-600">
            Awaiting review for stage {{ pipeline.currentStage.value ?? 'current' }}
          </div>
          <div v-else class="text-sm text-gray-400">
            No review pending
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import CaseStatusBadge from '@/components/CaseStatusBadge.vue'
import { useCaseStore } from '@/stores/case'
import { useCaseEvents } from '@/composables/useCaseEvents'
import { usePipeline } from '@/composables/usePipeline'
import type { StageStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const caseStore = useCaseStore()

const caseId = computed<string>(() => route.params.id as string)

const caseEvents = useCaseEvents(caseId)
const currentCaseRef = toRef(caseStore, 'currentCase')
const pipeline = usePipeline(currentCaseRef)

// Derive a stable list of pipeline stages for rendering lightweight placeholder
const pipelineStages = computed(() => pipeline?.stages?.value ?? [])

function goBack() {
  router.push('/cases')
}

async function handleStart() {
  await caseStore.startPipeline(caseId.value)
  caseEvents.connect()
}

function stageColor(status: StageStatus): string {
  const colors: Record<StageStatus, string> = {
    pending: 'bg-gray-300',
    running: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    waiting_review: 'bg-yellow-400',
  }
  return colors[status] ?? 'bg-gray-300'
}
 
onMounted(async () => {
  await caseStore.loadCase(caseId.value)
  if (caseStore.currentCase?.status !== 'created') {
    caseEvents.connect()
  }
})
</script>

<style scoped>
/* No additional styles; rely on existing design system tokens (Tailwind). */
</style>
