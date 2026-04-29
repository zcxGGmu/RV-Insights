<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-vue-next'

defineProps<{
  title: string
  status?: 'running' | 'done' | 'error'
  count?: number
}>()

const collapsed = ref(false)
</script>

<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700">
    <button
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      @click="collapsed = !collapsed"
    >
      <component :is="collapsed ? ChevronRight : ChevronDown" class="size-3.5 text-gray-400" />
      <Loader2 v-if="status === 'running'" class="size-3.5 animate-spin text-blue-500" />
      <span class="font-medium text-gray-700 dark:text-gray-300">{{ title }}</span>
      <span v-if="count" class="ml-auto text-xs text-gray-400">{{ count }}</span>
    </button>

    <div v-if="!collapsed" class="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
      <slot />
    </div>
  </div>
</template>
