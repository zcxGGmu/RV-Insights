<script setup lang="ts">
defineProps<{
  current: number
  max: number
}>()
</script>

<template>
  <div class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
    :class="{
      'bg-green-100 text-green-700': current <= 1,
      'bg-yellow-100 text-yellow-700': current === 2,
      'bg-red-100 text-red-700': current >= 3,
    }"
  >
    Iteration {{ current }}/{{ max }}
  </div>
</template>
