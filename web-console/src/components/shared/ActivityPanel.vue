<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-vue-next'

export interface ActivityItem {
  id: string
  type: 'thinking' | 'tool_call' | 'tool_result'
  label: string
  status: 'running' | 'done' | 'error'
  timestamp: number
  detail?: string
}

const props = defineProps<{
  items: ActivityItem[]
  collapsed?: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const hasItems = computed(() => props.items.length > 0)
const runningCount = computed(() => props.items.filter((i) => i.status === 'running').length)
</script>

<template>
  <div v-if="hasItems" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
      @click="emit('toggle')"
    >
      <Loader2 v-if="runningCount > 0" class="size-3.5 animate-spin" />
      <Wrench v-else class="size-3.5" />
      <span>{{ items.length }} 步骤{{ runningCount > 0 ? ` (${runningCount} 进行中)` : '' }}</span>
    </button>

    <div v-if="!collapsed" class="border-t border-gray-100 dark:border-gray-800">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-start gap-2 px-3 py-1.5 text-xs"
      >
        <Loader2 v-if="item.status === 'running'" class="size-3.5 mt-0.5 shrink-0 animate-spin text-blue-500" />
        <CheckCircle2 v-else-if="item.status === 'done'" class="size-3.5 mt-0.5 shrink-0 text-green-500" />
        <XCircle v-else class="size-3.5 mt-0.5 shrink-0 text-red-500" />
        <div class="min-w-0 flex-1">
          <span class="text-gray-700 dark:text-gray-300">{{ item.label }}</span>
          <p v-if="item.detail" class="mt-0.5 truncate text-gray-400">{{ item.detail }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
