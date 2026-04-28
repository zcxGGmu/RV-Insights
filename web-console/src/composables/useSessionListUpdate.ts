import { ref } from 'vue'

const onSessionTitleUpdate = ref<((sessionId: string, title: string) => void) | null>(null)

export function useSessionListUpdate() {
  return {
    setOnSessionTitleUpdate: (fn: ((sessionId: string, title: string) => void) | null) => {
      onSessionTitleUpdate.value = fn
    },
    updateSessionTitle: (sessionId: string, title: string) => {
      onSessionTitleUpdate.value?.(sessionId, title)
    },
  }
}
