<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import ChatBox from '@/components/chat/ChatBox.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import SuggestedQuestions from '@/components/chat/SuggestedQuestions.vue'
import ActivityPanel from '@/components/shared/ActivityPanel.vue'
import PlanPanel from '@/components/chat/PlanPanel.vue'
import ToolPanel from '@/components/chat/ToolPanel.vue'
import FilePanel from '@/components/chat/FilePanel.vue'
import { useChatStore } from '@/stores/chat'
import { connectChatSSE, stopChat } from '@/api/chat'
import { consumePendingChat } from '@/composables/usePendingChat'
import { useRightPanel } from '@/composables/useRightPanel'
import { useFilePanel } from '@/composables/useFilePanel'
import { extractXmlTags } from '@/utils/markdownFormatter'
import type { ActivityItem } from '@/components/shared/ActivityPanel.vue'
import type { PlanStep } from '@/components/chat/PlanPanel.vue'
import type { ToolCallGroup } from '@/composables/useMessageGrouper'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const route = useRoute()
const store = useChatStore()
const { panelType, closePanel } = useRightPanel()
const filePanel = useFilePanel()

const sessionId = ref(route.params.id as string)
const messages = ref<Message[]>([])
const input = ref('')
const isLoading = ref(false)
const streamingContent = ref('')
const streamingEventId = ref('')
const suggestedQuestions = ref<string[]>([])
const activityItems = ref<ActivityItem[]>([])
const activityCollapsed = ref(true)
const planSteps = ref<PlanStep[]>([])
const planCollapsed = ref(false)
const toolCalls = ref<ToolCallGroup[]>([])
const scrollRef = ref<HTMLElement | null>(null)
const chatBoxRef = ref<InstanceType<typeof ChatBox> | null>(null)

let abortController: AbortController | null = null
const processedEventIds = new Set<string>()

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  })
}

function restoreSession(events: any[]) {
  for (const ev of events) {
    if (processedEventIds.has(ev.event_id)) continue
    processedEventIds.add(ev.event_id)

    if (ev.type === 'message') {
      const role = ev.data?.role
      const content = ev.data?.content || ''
      if (role === 'user' || role === 'assistant') {
        messages.value = [
          ...messages.value,
          { id: ev.event_id, role, content, timestamp: ev.timestamp },
        ]
      }
    }
  }
}

function handleSSEEvent(event: string, data: any) {
  const eventId = data.event_id || ''
  if (eventId && processedEventIds.has(eventId)) return
  if (eventId) processedEventIds.add(eventId)

  switch (event) {
    case 'message_chunk': {
      if (streamingEventId.value !== eventId && eventId) {
        streamingEventId.value = eventId
        streamingContent.value = ''
      }
      streamingContent.value += data.content || ''
      scrollToBottom()
      break
    }
    case 'message_chunk_done': {
      if (streamingContent.value) {
        const { cleanedText, tags } = extractXmlTags(streamingContent.value)
        messages.value = [
          ...messages.value,
          {
            id: streamingEventId.value || eventId,
            role: 'assistant',
            content: cleanedText,
            timestamp: data.timestamp || Date.now() / 1000,
          },
        ]
        if (tags.suggested_questions) {
          try {
            const parsed = JSON.parse(tags.suggested_questions)
            suggestedQuestions.value = Array.isArray(parsed) ? parsed : []
          } catch {
            suggestedQuestions.value = tags.suggested_questions
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean)
          }
        }
      }
      streamingContent.value = ''
      streamingEventId.value = ''
      scrollToBottom()
      break
    }
    case 'done': {
      isLoading.value = false
      store.isStreaming = false
      store.fetchSessions()
      break
    }
    case 'error': {
      isLoading.value = false
      store.isStreaming = false
      if (data.error) {
        messages.value = [
          ...messages.value,
          {
            id: eventId || `err-${Date.now()}`,
            role: 'assistant',
            content: `**错误**: ${data.error}`,
            timestamp: Date.now() / 1000,
          },
        ]
      }
      break
    }
    case 'thinking': {
      activityItems.value = [
        ...activityItems.value,
        { id: eventId, type: 'thinking', label: '思考中...', status: 'running', timestamp: Date.now() / 1000 },
      ]
      break
    }
    case 'tool': {
      const label = data.tool_name || data.name || '工具调用'
      const status = data.status === 'called' ? 'done' : data.status === 'error' ? 'error' : 'running'
      activityItems.value = [
        ...activityItems.value,
        {
          id: eventId,
          type: 'tool_call',
          label,
          status,
          timestamp: Date.now() / 1000,
          detail: data.content?.substring(0, 100),
        },
      ]

      const toolCallId = data.tool_call_id || eventId
      const existing = toolCalls.value.find((tc) => tc.toolCallId === toolCallId)
      if (existing) {
        toolCalls.value = toolCalls.value.map((tc) =>
          tc.toolCallId === toolCallId
            ? { ...tc, status: data.status || tc.status, content: data.content || tc.content }
            : tc,
        )
      } else {
        toolCalls.value = [
          ...toolCalls.value,
          {
            toolCallId,
            name: data.name || data.tool_name || '',
            args: data.args || {},
            status: data.status || 'calling',
            content: data.content || '',
          },
        ]
      }
      break
    }
    case 'plan': {
      const steps = data.steps || []
      planSteps.value = steps.map((s: any, i: number) => ({
        id: s.id || `step-${i}`,
        label: s.label || s.title || `步骤 ${i + 1}`,
        status: s.status || 'pending',
        detail: s.detail,
      }))
      break
    }
    case 'step': {
      const stepId = data.step_id || data.id
      if (stepId) {
        planSteps.value = planSteps.value.map((s) =>
          s.id === stepId ? { ...s, status: data.status || s.status, detail: data.detail || s.detail } : s,
        )
      }
      break
    }
  }
}

function sendMessage(text: string) {
  if (!text.trim() || isLoading.value) return

  messages.value = [
    ...messages.value,
    { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() / 1000 },
  ]
  input.value = ''
  suggestedQuestions.value = []
  activityItems.value = []
  planSteps.value = []
  toolCalls.value = []
  isLoading.value = true
  store.isStreaming = true
  scrollToBottom()

  abortController = connectChatSSE(sessionId.value, { message: text }, {
    onMessage: handleSSEEvent,
    onError: () => {
      isLoading.value = false
      store.isStreaming = false
    },
  })
}

function handleSubmit() {
  sendMessage(input.value)
}

async function handleStop() {
  abortController?.abort()
  abortController = null
  await stopChat(sessionId.value)
  isLoading.value = false
  store.isStreaming = false
}

function handleSuggestionClick(question: string) {
  sendMessage(question)
}

function handleFileUpload() {
  const input = document.createElement('input')
  input.type = 'file'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file) {
      await filePanel.upload(sessionId.value, file)
    }
  }
  input.click()
}

onMounted(async () => {
  const res = await store.fetchSession(sessionId.value)
  if (res?.code === 0 && res.data.events) {
    restoreSession(res.data.events)
    scrollToBottom()
  }

  filePanel.loadFiles(sessionId.value)

  const pending = consumePendingChat()
  if (pending?.message) {
    sendMessage(pending.message)
  }

  chatBoxRef.value?.focus()
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId && newId !== sessionId.value) {
      sessionId.value = newId as string
      messages.value = []
      streamingContent.value = ''
      processedEventIds.clear()
      suggestedQuestions.value = []
      activityItems.value = []
      planSteps.value = []
      toolCalls.value = []
      abortController?.abort()
      abortController = null
      isLoading.value = false
      store.isStreaming = false
      closePanel()
      filePanel.clearFiles()
      store.fetchSession(sessionId.value).then((res) => {
        if (res?.code === 0 && res.data.events) {
          restoreSession(res.data.events)
          scrollToBottom()
        }
      })
      filePanel.loadFiles(sessionId.value)
    }
  },
)
</script>

<template>
  <div class="flex h-full">
    <div class="flex flex-1 flex-col overflow-hidden">
      <div ref="scrollRef" class="flex-1 overflow-y-auto px-4 md:px-8 lg:px-16">
        <div class="mx-auto max-w-3xl py-4">
          <ChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :role="msg.role"
            :content="msg.content"
            :timestamp="msg.timestamp"
          />

          <ChatMessage
            v-if="streamingContent"
            role="assistant"
            :content="streamingContent"
            :streaming="true"
          />

          <div v-if="isLoading && !streamingContent" class="flex items-center gap-2 py-4">
            <Loader2 class="size-4 animate-spin text-gray-400" />
            <span class="text-sm text-gray-400">思考中...</span>
          </div>

          <PlanPanel
            :steps="planSteps"
            :collapsed="planCollapsed"
            @toggle="planCollapsed = !planCollapsed"
          />

          <ActivityPanel
            :items="activityItems"
            :collapsed="activityCollapsed"
            @toggle="activityCollapsed = !activityCollapsed"
          />

          <SuggestedQuestions
            :questions="suggestedQuestions"
            @click="handleSuggestionClick"
          />
        </div>
      </div>

      <div class="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-8 lg:px-16">
        <div class="mx-auto max-w-3xl">
          <ChatBox
            ref="chatBoxRef"
            v-model="input"
            :is-running="isLoading"
            @submit="handleSubmit"
            @stop="handleStop"
          />
        </div>
      </div>
    </div>

    <div v-if="panelType" class="w-80 shrink-0">
      <ToolPanel
        v-if="panelType === 'tool'"
        :tool-calls="toolCalls"
        @close="closePanel"
      />
      <FilePanel
        v-if="panelType === 'file'"
        :files="filePanel.files.value"
        :selected-file-id="filePanel.selectedFileId.value"
        @close="closePanel"
        @select="filePanel.selectFile"
        @upload="handleFileUpload"
      />
    </div>
  </div>
</template>
