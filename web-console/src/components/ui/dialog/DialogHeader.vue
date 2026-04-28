<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div :class="cn('pt-5 px-6 pb-2 pe-8', props.class)">
    <slot />
  </div>
</template>
