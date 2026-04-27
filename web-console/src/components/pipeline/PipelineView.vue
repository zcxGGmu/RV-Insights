<template>
  <div class="space-y-0">
    <StageNode
      v-for="(stage, index) in stages"
      :key="stage.id"
      :stage="stage"
      :is-current="stage.id === currentStage"
      :is-last="index === stages.length - 1"
    />
  </div>
</template>

<script setup lang="ts">
import StageNode from './StageNode.vue'
import type { PipelineStage } from '@/types'

const { stages, currentStage } = defineProps<{
  stages: PipelineStage[]
  currentStage: string | null
}>()
</script>
