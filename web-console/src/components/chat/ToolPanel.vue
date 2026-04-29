<script setup lang="ts">
import { X, Wrench, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { ref } from 'vue'
import type { ToolCallGroup } from '@/composables/useMessageGrouper'

defineProps<{
  toolCalls: ToolCallGroup[]
}>()

const emit = defineEmits<{
  close: []
}>()

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedIds.value = next
}

const statusBadge = {
  calling: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  called: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const statusLabel = {
  calling: '执行中',
  called: '已完成',
  error: '失败',
}
</script>

<template>
  <div class="flex h-full flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div class="flex h-10 shrink-0 items-center justify-between border-b border-gray-200 px-3 dark:border-gray-700">
      <div class="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Wrench class="size-4" />
        工具调用
      </div>
      <button
        class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-3">
      <div v-if="!toolCalls.length" class="py-8 text-center text-sm text-gray-400">
        暂无工具调用
      </div>

      <div v-for="tc in toolCalls" :key="tc.toolCallId" class="mb-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
          @click="toggleExpand(tc.toolCallId)"
        >
          <component :is="expandedIds.has(tc.toolCallId) ? ChevronDown : ChevronRight" class="size-3.5 text-gray-400" />
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ tc.name }}</span>
          <span class="ml-auto rounded-full px-2 py-0.5 text-xs" :class="statusBadge[tc.status]">
            {{ statusLabel[tc.status] }}
          </span>
        </button>

        <div v-if="expandedIds.has(tc.toolCallId)" class="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
          <div v-if="Object.keys(tc.args).length" class="mb-2">
            <p class="mb-1 text-xs font-medium text-gray-500">参数</p>
            <pre class="rounded bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{{ JSON.stringify(tc.args, null, 2) }}</pre>
          </div>
          <div v-if="tc.content">
            <p class="mb-1 text-xs font-medium text-gray-500">结果</p>
            <pre class="max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{{ tc.content }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
