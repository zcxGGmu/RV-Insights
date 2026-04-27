import { ref, onUnmounted, type Ref, watch } from 'vue'
import { connectSSE } from '@/api/client'
import { useCaseStore } from '@/stores/case'
import type { PipelineEvent } from '@/types'

// Manage streaming of case events (SSE) for a given caseId
export function useCaseEvents(caseId: Ref<string>) {
  const events = ref<PipelineEvent[]>([])
  const isConnected = ref(false)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null
  const caseStore = useCaseStore()

  function connect() {
    disconnect()
    error.value = null

    // Build URL for SSE streaming
    const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || ''
    const url = `${baseUrl}/api/v1/cases/${caseId.value}/events`

    // SSE connection with auth header support
    controller = connectSSE(url, {
      onOpen: () => {
        isConnected.value = true
      },
      onMessage: (msg) => {
        if (!msg.data || msg.data === '{}') return
        try {
          const event: PipelineEvent = JSON.parse(msg.data)
          events.value.push(event)
          caseStore.addEvent(event)

          if (event.event_type === 'stage_change' || event.event_type === 'completed') {
            caseStore.loadCase(caseId.value)
          }
        } catch {
          // skip malformed events
        }
      },
      onError: (err) => {
        isConnected.value = false
        error.value = err?.message ?? 'SSE connection error'
      },
    })
  }

  function disconnect() {
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
