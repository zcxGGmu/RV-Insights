<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2, AlertCircle } from 'lucide-vue-next'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import { getSharedSession } from '@/api/chat'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const route = useRoute()
const sessionId = ref(route.params.id as string)
const title = ref('')
const messages = ref<Message[]>([])
const loading = ref(true)
const error = ref('')

function parseEvents(events: any[]): Message[] {
  const result: Message[] = []
  for (const ev of events) {
    if (ev.type === 'message') {
      const role = ev.data?.role
      const content = ev.data?.content || ''
      if (role === 'user' || role === 'assistant') {
        result.push({ id: ev.event_id, role, content, timestamp: ev.timestamp })
      }
    }
  }
  return result
}

onMounted(async () => {
  try {
    const res = await getSharedSession(sessionId.value)
    if (res.code === 0) {
      title.value = res.data.title || '共享对话'
      messages.value = parseEvents(res.data.events || [])
    } else {
      error.value = res.msg || '无法加载共享对话'
    }
  } catch {
    error.value = '对话不存在或已取消共享'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 md:px-8">
    <h1 v-if="title" class="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
      {{ title }}
    </h1>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <Loader2 class="size-6 animate-spin text-gray-400" />
    </div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center">
      <AlertCircle class="size-10 text-gray-300" />
      <p class="text-sm text-gray-500">{{ error }}</p>
    </div>

    <template v-else>
      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :role="msg.role"
        :content="msg.content"
        :timestamp="msg.timestamp"
      />
      <p v-if="!messages.length" class="py-8 text-center text-sm text-gray-400">
        该对话暂无消息
      </p>
    </template>
  </div>
</template>
