import { ref, onUnmounted, type Ref, watch } from 'vue'
import { connectSSE } from '@/api/client'
import { useCaseStore } from '@/stores/case'
import type { PipelineEvent } from '@/types'

const USE_MOCK = (import.meta as any).env?.VITE_USE_MOCK === 'true'

function parseSSEMessage(msg: { data: string }): PipelineEvent | null {
  if (!msg.data || msg.data === '{}') return null
  try {
    return JSON.parse(msg.data)
  } catch {
    return null
  }
}

function handleEvent(event: PipelineEvent | null, eventsRef: Ref<PipelineEvent[]>, caseStore: ReturnType<typeof useCaseStore>, caseId: string) {
  if (!event) return
  eventsRef.value.push(event)
  caseStore.addEvent(event)
  if (event.event_type === 'stage_change' || event.event_type === 'completed') {
    caseStore.loadCase(caseId)
  }
}

export function useCaseEvents(caseId: Ref<string>) {
  const events = ref<PipelineEvent[]>([])
  const isConnected = ref(false)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null
  let mockCleanup: (() => void) | null = null
  const caseStore = useCaseStore()

  async function connect() {
    disconnect()
    error.value = null

    if (USE_MOCK) {
      const { mockSSEStream } = await import('@/api/mock')
      mockCleanup = await mockSSEStream(caseId.value, {
        onOpen: () => { isConnected.value = true },
        onMessage: (msg) => {
          const event = parseSSEMessage(msg)
          handleEvent(event, events, caseStore, caseId.value)
        },
        onError: (err) => {
          isConnected.value = false
          error.value = err?.message ?? 'Mock SSE error'
        },
      })
      return
    }

    const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || ''
    const url = `${baseUrl}/api/v1/cases/${caseId.value}/events`

    controller = connectSSE(url, {
      onOpen: () => { isConnected.value = true },
      onMessage: (msg) => {
        const event = parseSSEMessage(msg)
        handleEvent(event, events, caseStore, caseId.value)
      },
      onError: (err) => {
        isConnected.value = false
        error.value = err?.message ?? 'SSE connection error'
      },
    })
  }

  function disconnect() {
    if (mockCleanup) {
      mockCleanup()
      mockCleanup = null
    }
    if (controller) {
      controller.abort()
      controller = null
    }
    isConnected.value = false
  }

  watch(caseId, (newId, oldId) => {
    if (newId !== oldId && newId) {
      events.value = []
      connect()
    }
  })

  onUnmounted(() => {
    disconnect()
  })

  return { events, isConnected, error, connect, disconnect }
}
