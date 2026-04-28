<script setup lang="ts">
defineProps<{
  questions: string[]
}>()

const emit = defineEmits<{
  click: [question: string]
}>()
</script>

<template>
  <div v-if="questions.length > 0" class="flex flex-wrap gap-2 py-2">
    <button
      v-for="q in questions"
      :key="q"
      class="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-blue-600 dark:hover:text-blue-400"
      @click="emit('click', q)"
    >
      {{ q }}
    </button>
  </div>
</template>
