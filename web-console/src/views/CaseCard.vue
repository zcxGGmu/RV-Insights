<template>
  <div class="bg-white rounded-lg shadow p-4 flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-lg">{{ caseItem.title }}</h3>
      <CaseStatusBadge :status="caseItem.status" />
    </div>
    <div class="text-sm text-gray-600 mt-2">Repo: {{ caseItem.target_repo }}</div>
    <div class="mt-auto text-xs text-gray-500">Created: {{ caseItem.created_at }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Case } from '@/types'
import CaseStatusBadge from '@/components/CaseStatusBadge.vue'
const props = defineProps<{ caseItem: Case }>()
</script>
