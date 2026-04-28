<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { renderMarkdown, renderMermaidInContainer } from '@/utils/markdown'

const props = defineProps<{
  content: string
  streaming?: boolean
}>()

const containerRef = ref<HTMLElement | null>(null)

const html = computed(() => renderMarkdown(props.content))

async function processMermaid() {
  await nextTick()
  if (containerRef.value) {
    await renderMermaidInContainer(containerRef.value)
  }
}

onMounted(processMermaid)

watch(
  () => props.content,
  () => {
    if (!props.streaming) {
      processMermaid()
    }
  },
)

watch(
  () => props.streaming,
  (val) => {
    if (!val) processMermaid()
  },
)
</script>

<template>
  <div
    ref="containerRef"
    class="markdown-body prose prose-sm max-w-none dark:prose-invert"
    v-html="html"
  />
</template>
