import { ref, computed } from 'vue'
import type { User } from '../types'
import { loginUser, registerUser, refreshToken, logoutUser } from '../api/auth'
import { apiClient } from '../api/client'

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function useAuth() {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => !!user.value)
  const isLoading = ref(false)

  async function login(email: string, password: string): Promise<void> {
    isLoading.value = true
    try {
      await loginUser({ email, password })
      const token = localStorage.getItem('rv_access_token')
      if (token) {
        const payload = decodeJwtPayload(token)
        if (payload) {
          user.value = {
            id: payload.sub ?? '',
            username: payload.username ?? payload.name ?? '',
            email: payload.email ?? email,
            role: ((payload.role as unknown) as string) ?? 'viewer'
          }
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  async function register(username: string, email: string, password: string): Promise<void> {
    isLoading.value = true
    try {
      const data = await registerUser({ username, email, password })
      // If server returns tokens, store them and decode user
      const token = localStorage.getItem('rv_access_token')
      if (token) {
        const payload = decodeJwtPayload(token)
        if (payload) {
          user.value = {
            id: payload.sub ?? '',
            username: payload.username ?? payload.name ?? '',
            email: payload.email ?? email,
            role: ((payload.role as unknown) as string) ?? 'viewer'
          }
        }
      }
      return
    } finally {
      isLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    await logoutUser()
    user.value = null
  }

  async function refreshAuth(): Promise<boolean> {
    const refresh = localStorage.getItem('rv_refresh_token')
    if (!refresh) return false
    try {
      const data = await refreshToken(refresh)
      if (data?.access_token) {
        localStorage.setItem('rv_access_token', data.access_token)
        const payload = decodeJwtPayload(data.access_token)
        if (payload) {
          user.value = {
            id: payload.sub ?? '',
            username: payload.username ?? payload.name ?? '',
            email: payload.email ?? '',
            role: ((payload.role as unknown) as string) ?? 'viewer'
          }
        }
        return true
      }
    } catch {
      // ignore
    }
    return false
  }

  function loadFromStorage(): void {
    const token = localStorage.getItem('rv_access_token')
    if (token) {
      const payload = decodeJwtPayload(token)
      if (payload) {
        user.value = {
          id: payload.sub ?? '',
          username: payload.username ?? payload.name ?? '',
          email: payload.email ?? '',
          role: (payload.role as string) ?? 'viewer'
        }
      }
    }
  }

  // Auto-load on creation
  loadFromStorage()

  return { user, isAuthenticated, isLoading, login, register, logout, refreshAuth, loadFromStorage }
}
