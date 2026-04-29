import { apiClient } from './client'

const BASE = '/api/v1/models'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  base_url: string | null
  api_key_set: boolean
  model_name: string
  context_window: number
  temperature: number
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateModelPayload {
  name: string
  provider: string
  base_url?: string
  api_key?: string
  model_name: string
  context_window?: number
  temperature?: number
}

export interface UpdateModelPayload {
  name?: string
  base_url?: string
  api_key?: string
  model_name?: string
  context_window?: number
  temperature?: number
  is_active?: boolean
}

export async function listModels() {
  const res = await apiClient.get(BASE)
  return res.data
}

export async function createModel(payload: CreateModelPayload) {
  const res = await apiClient.post(BASE, payload)
  return res.data
}

export async function updateModel(modelId: string, payload: UpdateModelPayload) {
  const res = await apiClient.put(`${BASE}/${modelId}`, payload)
  return res.data
}

export async function deleteModel(modelId: string) {
  const res = await apiClient.delete(`${BASE}/${modelId}`)
  return res.data
}

export async function detectContextWindow(payload: {
  provider: string
  base_url?: string
  api_key?: string
  model_name: string
}) {
  const res = await apiClient.post(`${BASE}/detect-context-window`, payload)
  return res.data
}
