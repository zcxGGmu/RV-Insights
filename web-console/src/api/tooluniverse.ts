import { apiClient } from './client'

const BASE = '/api/v1/tooluniverse'

export async function listTUTools(params?: { search?: string; category?: string; lang?: string }) {
  const res = await apiClient.get(`${BASE}/tools`, { params })
  return res.data
}

export async function getTUTool(name: string, lang = 'en') {
  const res = await apiClient.get(`${BASE}/tools/${name}`, { params: { lang } })
  return res.data
}

export async function runTUTool(name: string, args: Record<string, any>) {
  const res = await apiClient.post(`${BASE}/tools/${name}/run`, { arguments: args })
  return res.data
}

export async function listTUCategories(lang = 'en') {
  const res = await apiClient.get(`${BASE}/categories`, { params: { lang } })
  return res.data
}
