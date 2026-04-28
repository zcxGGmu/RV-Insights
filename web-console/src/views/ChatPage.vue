<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const sessionId = route.params.id as string
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 overflow-y-auto p-4">
      <p class="text-gray-500">Chat session: {{ sessionId }}</p>
    </div>
  </div>
</template>
