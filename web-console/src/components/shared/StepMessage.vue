<script setup lang="ts">
import { CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-vue-next'

defineProps<{
  label: string
  status?: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}>()

const icons = {
  pending: Circle,
  running: Loader2,
  done: CheckCircle,
  error: AlertCircle,
}

const colors = {
  pending: 'text-gray-400',
  running: 'text-blue-500 animate-spin',
  done: 'text-green-500',
  error: 'text-red-500',
}
</script>

<template>
  <div class="flex items-start gap-2 py-1">
    <component
      :is="icons[status || 'pending']"
      class="mt-0.5 size-3.5 shrink-0"
      :class="colors[status || 'pending']"
    />
    <div class="min-w-0 flex-1">
      <p class="text-sm text-gray-700 dark:text-gray-300">{{ label }}</p>
      <p v-if="detail" class="text-xs text-gray-400">{{ detail }}</p>
    </div>
  </div>
</template>
