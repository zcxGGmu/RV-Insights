import { apiClient } from './client'
import type { ReviewDecision } from '@/types'
const USE_MOCK = (import.meta as any).env?.VITE_USE_MOCK === 'true'

export async function createCase(data: { title: string; target_repo: string; input_context: string; contribution_type?: string }) {
  if (USE_MOCK) {
    const m = await import('./mock')
    return m.setupMockApi().createCase(data)
  }
  const res = await apiClient.post('/api/v1/cases', data)
  return res.data
}

export async function listCases(params?: { page?: number; per_page?: number; status?: string; target_repo?: string }) {
  if (USE_MOCK) {
    const m = await import('./mock')
    return m.setupMockApi().listCases(params)
  }
  const res = await apiClient.get('/api/v1/cases', { params })
  return res.data
}

export async function getCase(caseId: string) {
  if (USE_MOCK) {
    const m = await import('./mock')
    return m.setupMockApi().getCase(caseId)
  }
  const res = await apiClient.get(`/api/v1/cases/${caseId}`)
  return res.data
}

export async function deleteCase(caseId: string) {
  const res = await apiClient.delete(`/api/v1/cases/${caseId}`)
  return res.data
}

// Start the pipeline for a given case
export async function startPipeline(caseId: string): Promise<any> {
  if (USE_MOCK) {
    const m = await import('./mock')
    return m.setupMockApi().startPipeline(caseId)
  }
  const res = await apiClient.post(`/api/v1/cases/${caseId}/start`)
  return res.data
}

// Submit a review decision for a given case
export async function submitReview(caseId: string, decision: ReviewDecision): Promise<any> {
  if (USE_MOCK) {
    const m = await import('./mock')
    return m.setupMockApi().submitReview(caseId, decision)
  }
  const res = await apiClient.post(`/api/v1/cases/${caseId}/review`, decision)
  return res.data
}
