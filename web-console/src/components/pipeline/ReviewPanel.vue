<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <ClipboardCheck class="w-4 h-4 text-gray-500" />
      <h3 class="text-sm font-semibold text-gray-700">Review Decision</h3>
    </div>

    <div v-if="!isWaitingReview" class="text-sm text-gray-400 py-4 text-center">
      No review pending
    </div>

    <template v-else>
      <p class="text-sm text-gray-600">
        Stage <span class="font-medium">{{ currentStage }}</span> is awaiting your review.
      </p>

      <!-- Comment textarea (shown when rejecting) -->
      <div v-if="showComment" class="space-y-2">
        <textarea
          v-model="comment"
          rows="3"
          placeholder="Reason for rejection..."
          class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
      </div>

      <!-- Action buttons -->
      <div class="flex flex-col gap-2">
        <button
          @click="handleApprove"
          :disabled="isSubmitting"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle2 class="w-4 h-4" />
          Approve
        </button>

        <button
          v-if="!showComment"
          @click="showComment = true"
          :disabled="isSubmitting"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
        >
          <RotateCcw class="w-4 h-4" />
          Reject
        </button>

        <button
          v-else
          @click="handleReject"
          :disabled="isSubmitting || !comment.trim()"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
        >
          <RotateCcw class="w-4 h-4" />
          Confirm Reject
        </button>

        <button
          @click="showAbandonConfirm = true"
          :disabled="isSubmitting"
          class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          <XCircle class="w-4 h-4" />
          Abandon
        </button>
      </div>

      <!-- Abandon confirmation -->
      <div v-if="showAbandonConfirm" class="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
        <p class="text-sm text-red-700">Are you sure? This will permanently stop the pipeline.</p>
        <div class="flex gap-2">
          <button
            @click="handleAbandon"
            :disabled="isSubmitting"
            class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Yes, Abandon
          </button>
          <button
            @click="showAbandonConfirm = false"
            class="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2, RotateCcw, XCircle, ClipboardCheck } from 'lucide-vue-next'
import type { ReviewDecision } from '@/types'

const { caseId, currentStage, isWaitingReview } = defineProps<{
  caseId: string
  currentStage: string
  isWaitingReview: boolean
}>()

const emit = defineEmits<{
  (e: 'review', decision: ReviewDecision): void
}>()

const comment = ref<string>('')
const showComment = ref<boolean>(false)
const showAbandonConfirm = ref<boolean>(false)
const isSubmitting = ref<boolean>(false)

async function handleApprove() {
  isSubmitting.value = true
  try {
    emit('review', { action: 'approve' })
  } finally {
    isSubmitting.value = false
  }
}

async function handleReject() {
  if (!comment.value.trim()) return
  isSubmitting.value = true
  try {
    emit('review', { action: 'reject', comment: comment.value.trim() })
    comment.value = ''
    showComment.value = false
  } finally {
    isSubmitting.value = false
  }
}

async function handleAbandon() {
  isSubmitting.value = true
  try {
    emit('review', { action: 'abandon' })
    showAbandonConfirm.value = false
  } finally {
    isSubmitting.value = false
  }
}
</script>
