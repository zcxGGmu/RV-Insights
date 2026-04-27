import axios, { type AxiosInstance } from 'axios'

// Axios instance with base URL from env
export const apiClient: AxiosInstance = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || ''
})

// Token helpers
function getToken(): string | null {
  try {
    return localStorage.getItem('rv_access_token')
  } catch {
    return null
  }
}

// Attach token to each request
apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    if (!config.headers) config.headers = {} as any
    // Avoid overwriting existing header if present
    ;(config.headers as any)['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Separate instance for refresh requests to avoid circular interception
const refreshApi = axios.create({ baseURL: apiClient.defaults.baseURL as any })

// Refresh token workflow
apiClient.interceptors.response.use(undefined, async (error) => {
  const originalRequest = error?.config
  if (
    error?.response?.status === 401 &&
    originalRequest &&
    !originalRequest.__isRetry
  ) {
    originalRequest.__isRetry = true
    const refreshToken = localStorage.getItem('rv_refresh_token')
    if (!refreshToken) {
      return Promise.reject(error)
    }
      try {
        const res = await refreshApi.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken
        })
        const data = res.data || {}
      if (data.access_token) {
        localStorage.setItem('rv_access_token', data.access_token)
        // Update the Authorization header and retry
        originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`
        return apiClient(originalRequest)
      }
    } catch {
      // Fall through to error below
    }
  }
  return Promise.reject(error)
})

// SSE helper using @microsoft/fetch-event-source
import { fetchEventSource, type EventSourceMessage as FetchEventMessage } from '@microsoft/fetch-event-source'

export function connectSSE(
  url: string,
  handlers: {
    onMessage: (event: FetchEventMessage) => void
    onError?: (err: any) => void
    onOpen?: () => void
  }
): AbortController {
  const controller = new AbortController()
  fetchEventSource(url, {
    signal: controller.signal,
    onmessage: (ev: any) => handlers.onMessage(ev as FetchEventMessage),
    onerror: handlers.onError as any,
    onopen: handlers.onOpen as any
  })
  return controller
}

export default apiClient
