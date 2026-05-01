import { apiClient } from './client'

const BASE = '/api/v1/sessions/tools'

export async function listTools() {
  const res = await apiClient.get(BASE)
  return res.data
}

export async function blockTool(name: string, blocked: boolean) {
  const res = await apiClient.put(`${BASE}/${name}/block`, { blocked })
  return res.data
}

export async function deleteTool(name: string) {
  const res = await apiClient.delete(`${BASE}/${name}`)
  return res.data
}

export async function readToolFile(name: string) {
  const res = await apiClient.post(`${BASE}/${name}/read`)
  return res.data
}

export async function saveToolFromSession(sessionId: string, toolName: string, replaces?: string) {
  const res = await apiClient.post(`/api/v1/sessions/${sessionId}/tools/save`, {
    tool_name: toolName,
    replaces: replaces || undefined,
  })
  return res.data
}
