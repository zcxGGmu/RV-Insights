import { apiClient } from './client'

const BASE = '/api/v1/statistics'

export interface StatsSummary {
  total_sessions: number
  total_messages: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_duration_ms: number
  total_tool_calls: number
}

export interface ModelStat {
  model_config_id: string | null
  session_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_duration_ms: number
}

export interface TrendPoint {
  date: string
  session_count: number
  total_tokens: number
}

export interface SessionStat {
  session_id: string
  title: string | null
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_duration_ms: number
  created_at: string | null
}

export async function getSummary(days = 30) {
  const res = await apiClient.get(`${BASE}/summary`, { params: { days } })
  return res.data
}

export async function getModelStats(days = 30) {
  const res = await apiClient.get(`${BASE}/models`, { params: { days } })
  return res.data
}

export async function getTrends(days = 30) {
  const res = await apiClient.get(`${BASE}/trends`, { params: { days } })
  return res.data
}

export async function getSessionStats(days = 30, limit = 20) {
  const res = await apiClient.get(`${BASE}/sessions`, { params: { days, limit } })
  return res.data
}
