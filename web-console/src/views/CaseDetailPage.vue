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

    <!-- Loading state -->
    <div v-if="caseStore.isLoading && !caseStore.currentCase" class="flex-1 flex items-center justify-center">
      <Loader2 class="w-8 h-8 text-blue-500 animate-spin" />
      <span class="ml-3 text-gray-500">Loading case...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="caseStore.error" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <XCircle class="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p class="text-red-600 font-medium">Failed to load case</p>
        <p class="text-sm text-gray-500 mt-1">{{ caseStore.error }}</p>
        <button @click="retryLoad" class="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    </div>

    <!-- Three-column body -->
    <div v-else class="flex flex-1 overflow-hidden flex-col md:flex-row">
      <!-- Left: Pipeline Visualization -->
      <aside class="w-full md:w-72 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Pipeline</h2>
        <PipelineView
          v-if="caseStore.stages.length"
          :stages="caseStore.stages"
          :current-stage="caseStore.currentStage"
        />

        <!-- SSE connection status -->
        <div class="mt-4 flex items-center gap-2 text-xs">
          <span
            class="w-2 h-2 rounded-full"
            :class="caseEvents.isConnected.value ? 'bg-green-500' : 'bg-gray-300'"
          />
          <span class="text-gray-500">{{ caseEvents.isConnected.value ? 'Live' : 'Disconnected' }}</span>
        </div>
      </aside>

      <!-- Center: Event Log / Agent Output -->
      <main class="flex-1 overflow-y-auto p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Events</h2>
        <div v-if="caseEvents.events.value.length === 0" class="text-sm text-gray-400">
          No events yet. Start the pipeline to see activity.
        </div>
        <AgentEventLog v-else :events="caseEvents.events.value" />
      </main>

      <!-- Right: Review Panel / Metadata / Stage Results -->
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

        <!-- Stage Results -->
        <ContributionCard
          v-if="caseStore.currentCase?.exploration_result"
          :result="caseStore.currentCase.exploration_result"
          class="mt-6"
        />
        <ExecutionPlanView
          v-if="caseStore.currentCase?.execution_plan"
          :plan="caseStore.currentCase.execution_plan"
          class="mt-4"
        />
        <DevelopmentResultCard
          v-if="caseStore.currentCase?.development_result"
          :result="caseStore.currentCase.development_result"
          class="mt-4"
        />
        <ReviewVerdictCard
          v-if="caseStore.currentCase?.review_verdict"
          :verdict="caseStore.currentCase.review_verdict"
          class="mt-4"
        />
        <IterationBadge
          v-if="caseStore.currentCase?.review_iterations"
          :current="caseStore.currentCase.review_iterations"
          :max="3"
          class="mt-3"
        />
        <TestResultCard
          v-if="caseStore.currentCase?.test_result"
          :result="caseStore.currentCase.test_result"
          class="mt-4"
        />
        <CompletionCard
          v-if="caseStore.currentCase?.status === 'completed'"
          :case-data="caseStore.currentCase"
          class="mt-4"
        />

        <!-- Review Panel -->
        <div class="mt-6">
          <ReviewPanel
            :case-id="caseId"
            :current-stage="caseStore.currentStage ?? ''"
            :is-waiting-review="caseStore.isWaitingReview"
            @review="handleReview"
          />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Loader2, XCircle } from 'lucide-vue-next'
import CaseStatusBadge from '@/components/CaseStatusBadge.vue'
import PipelineView from '@/components/pipeline/PipelineView.vue'
import ReviewPanel from '@/components/pipeline/ReviewPanel.vue'
import ContributionCard from '@/components/pipeline/ContributionCard.vue'
import ExecutionPlanView from '@/components/pipeline/ExecutionPlanView.vue'
import DevelopmentResultCard from '@/components/pipeline/DevelopmentResultCard.vue'
import ReviewVerdictCard from '@/components/pipeline/ReviewVerdictCard.vue'
import IterationBadge from '@/components/pipeline/IterationBadge.vue'
import TestResultCard from '@/components/pipeline/TestResultCard.vue'
import CompletionCard from '@/components/pipeline/CompletionCard.vue'
import AgentEventLog from '@/components/AgentEventLog.vue'
import { useCaseStore } from '@/stores/case'
import { useCaseEvents } from '@/composables/useCaseEvents'
import type { ReviewDecision } from '@/types'

const route = useRoute()
const router = useRouter()
const caseStore = useCaseStore()

const caseId = computed<string>(() => route.params.id as string)

const caseEvents = useCaseEvents(caseId)

function goBack() {
  router.push('/cases')
}

async function handleStart() {
  try {
    await caseStore.startPipeline(caseId.value)
    caseEvents.connect()
  } catch {
    // error already set in store
  }
}

async function handleReview(decision: ReviewDecision) {
  try {
    await caseStore.submitReview(caseId.value, decision)
  } catch {
    // error already set in store
  }
}

async function retryLoad() {
  try {
    await caseStore.loadCase(caseId.value)
  } catch {
    // error already set in store
  }
}

onMounted(async () => {
  await caseStore.loadCase(caseId.value)
  if (caseStore.currentCase?.status !== 'created') {
    caseEvents.connect()
  }
})
</script>
