<template>
  <div class="p-4">
    <button class="px-2 py-1 rounded border mb-4" @click="$router.back()">Back</button>
    <div class="bg-white rounded-lg p-6 shadow">
      <h2 class="text-2xl font-semibold mb-2">{{ caseItem?.title }}</h2>
      <CaseStatusBadge v-if="caseItem" :status="caseItem!.status" />
      <div class="mt-2 text-sm text-gray-700">Target: {{ caseItem?.target_repo }}</div>
      <div v-if="caseItem?.input_context" class="mt-4">
        <div class="font-medium">Input Context</div>
        <div class="text-sm text-gray-700">{{ caseItem!.input_context }}</div>
      </div>
      <div class="mt-6 text-sm text-gray-500">Created: {{ caseItem?.created_at }} • Updated: {{ caseItem?.updated_at }}</div>
      <div class="mt-4 border-t pt-4">
        <div class="text-sm text-gray-700">Pipeline stages (Sprint 2)</div>
        <div class="h-24 border rounded-md flex items-center justify-center text-gray-400">[Sprint 2: pipeline stages]</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import CaseStatusBadge from '@/components/CaseStatusBadge.vue'
import type { Case } from '@/types'
import { getCase } from '@/api/cases'

const route = useRoute()
const id = route.params.id as string
const caseItem = ref<Case | null>(null)

async function loadCase() {
  const c = await getCase(id)
  caseItem.value = c
}

onMounted(loadCase)
</script>
