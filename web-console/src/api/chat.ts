import { apiClient, connectSSE } from './client'
import { fetchEventSource, type EventSourceMessage } from '@microsoft/fetch-event-source'

const BASE = '/api/v1/sessions'

function getToken(): string | null {
  try {
    return localStorage.getItem('rv_access_token')
  } catch {
    return null
  }
}

export interface CreateSessionPayload {
  mode?: 'chat' | 'pipeline'
  model_config_id?: string
}

export interface ChatPayload {
  message: string
  attachments?: string[]
  event_id?: string
}

export interface SessionListItem {
  session_id: string
  title: string | null
  latest_message: string | null
  latest_message_at: number | null
  status: string
  unread_message_count: number
  is_shared: boolean
  mode: string
  pinned: boolean
  source: string | null
}

export interface SessionDetail {
  session_id: string
  title: string | null
  status: string
  events: any[]
  is_shared: boolean
  mode: string
  model_config_id: string | null
}

export async function createSession(payload: CreateSessionPayload = {}) {
  const res = await apiClient.put(BASE, payload)
  return res.data
}

export async function listSessions() {
  const res = await apiClient.get(BASE)
  return res.data
}

export async function getSession(sessionId: string) {
  const res = await apiClient.get(`${BASE}/${sessionId}`)
  return res.data
}

export async function deleteSession(sessionId: string) {
  const res = await apiClient.delete(`${BASE}/${sessionId}`)
  return res.data
}

export async function updatePin(sessionId: string, pinned: boolean) {
  const res = await apiClient.patch(`${BASE}/${sessionId}/pin`, { pinned })
  return res.data
}

export async function updateTitle(sessionId: string, title: string) {
  const res = await apiClient.patch(`${BASE}/${sessionId}/title`, { title })
  return res.data
}

export async function clearUnread(sessionId: string) {
  const res = await apiClient.post(`${BASE}/${sessionId}/clear_unread_message_count`)
  return res.data
}

export async function stopChat(sessionId: string) {
  const res = await apiClient.post(`${BASE}/${sessionId}/stop`)
  return res.data
}

export function connectChatSSE(
  sessionId: string,
  payload: ChatPayload,
  handlers: {
    onMessage: (event: string, data: any) => void
    onError?: (err: any) => void
    onOpen?: () => void
  },
): AbortController {
  const controller = new AbortController()
  const token = getToken()
  const baseURL = apiClient.defaults.baseURL || ''
  const url = `${baseURL}${BASE}/${sessionId}/chat`

  fetchEventSource(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
    onmessage(ev: EventSourceMessage) {
      try {
        const data = ev.data ? JSON.parse(ev.data) : {}
        handlers.onMessage(ev.event || 'message', data)
      } catch {
        handlers.onMessage(ev.event || 'message', { raw: ev.data })
      }
    },
    onerror(err: any) {
      handlers.onError?.(err)
    },
    async onopen() {
      handlers.onOpen?.()
    },
  })

  return controller
}

export function connectNotificationsSSE(
  handlers: {
    onMessage: (event: string, data: any) => void
    onError?: (err: any) => void
  },
): AbortController {
  return connectSSE(`${BASE}/notifications`, {
    onMessage(ev: EventSourceMessage) {
      try {
        const data = ev.data ? JSON.parse(ev.data) : {}
        handlers.onMessage(ev.event || 'notification', data)
      } catch {
        handlers.onMessage(ev.event || 'notification', { raw: ev.data })
      }
    },
    onError: handlers.onError,
  })
}
