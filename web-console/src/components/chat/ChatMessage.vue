<script setup lang="ts">
import { computed } from 'vue'
import { User, Bot, Copy, Check } from 'lucide-vue-next'
import { ref } from 'vue'
import MarkdownRenderer from '@/components/shared/MarkdownRenderer.vue'
import { copyToClipboard } from '@/utils/dom'

const props = defineProps<{
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  timestamp?: number
}>()

const copied = ref(false)

const isUser = computed(() => props.role === 'user')

async function handleCopy() {
  const ok = await copyToClipboard(props.content)
  if (ok) {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<template>
  <div class="flex gap-3 py-4" :class="isUser ? 'flex-row-reverse' : ''">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-full"
      :class="isUser ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'"
    >
      <User v-if="isUser" class="size-4 text-blue-600 dark:text-blue-400" />
      <Bot v-else class="size-4 text-gray-600 dark:text-gray-400" />
    </div>

    <div class="min-w-0 max-w-[80%]">
      <div
        v-if="isUser"
        class="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white"
      >
        {{ content }}
      </div>

      <div v-else class="group relative">
        <MarkdownRenderer :content="content" :streaming="streaming" />
        <button
          v-if="content && !streaming"
          class="absolute -bottom-6 right-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
          @click="handleCopy"
        >
          <Check v-if="copied" class="size-3" />
          <Copy v-else class="size-3" />
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
    </div>
  </div>
</template>
