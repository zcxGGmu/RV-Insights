import type { Case, ReviewDecision, CaseStatus } from '@/types'

const MOCK_DELAY = 200

let mockCases: Case[] = [
  {
    id: '1',
    title: 'Fix RISC-V timer interrupt',
    status: 'exploring',
    target_repo: 'riscv/linux',
    owner_id: 'mock@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
  } as Case,
  {
    id: '2',
    title: 'Add SBI extension support',
    status: 'planning',
    target_repo: 'riscv/opensbi',
    owner_id: 'mock@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
  } as Case,
  {
    id: '3',
    title: 'QEMU virtio driver fix',
    status: 'completed',
    target_repo: 'qemu/qemu',
    owner_id: 'mock@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
  } as Case,
]

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

export function setupMockApi() {
  return {
    listCases: async (params?: { page?: number; perPage?: number; status?: string; target_repo?: string; sort?: string }) => {
      const page = params?.page ?? 1
      const perPage = params?.perPage ?? 6
      let items = mockCases
      if (params?.status) items = items.filter(c => c.status === params!.status)
      if (params?.target_repo) items = items.filter(c => c.target_repo.includes(params!.target_repo!))
      if (params?.sort === 'created_desc') items = items.slice().sort((a,b)=> (a.created_at||'').localeCompare(b.created_at||''))
      const start = (page-1)*perPage
      return {
        items: items.slice(start, start+perPage),
        total: items.length,
        page,
        per_page: perPage
      }
    },
    createCase: async (data: { title: string; target_repo: string; input_context?: string }) => {
      const c: Case = {
        id: 'mock-' + Date.now(),
        title: data.title,
        status: 'created' as CaseStatus,
        target_repo: data.target_repo,
        owner_id: 'mock@example.com',
        input_context: data.input_context,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cost: { total_input_tokens: 0, total_output_tokens: 0, estimated_cost_usd: 0 },
      } as Case
      mockCases.push(c)
      return c
    },
    getCase: async (id: string) => {
      const found = mockCases.find(c => c.id === id)
      if (!found) throw new Error('Not Found')
      return found
    },
    // Start pipeline mock: move status to 'exploring'
    startPipeline: async (caseId: string) => {
      const c = mockCases.find(x => x.id === caseId)
      if (!c) throw new Error('Not Found')
      c.status = 'exploring' as any
      return { ...c }
    },
    // Submit a review mock: advance status or abandon
    submitReview: async (caseId: string, decision: ReviewDecision) => {
      const c = mockCases.find(x => x.id === caseId)
      if (!c) throw new Error('Not Found')
      if (decision.action === 'approve') {
        // advance to next logical phase based on current status
        const transitions: Record<string, CaseStatus> = {
          'created': 'exploring' as CaseStatus,
          'exploring': 'pending_explore_review' as CaseStatus,
          'pending_explore_review': 'planning' as CaseStatus,
          'planning': 'pending_plan_review' as CaseStatus,
          'pending_plan_review': 'developing' as CaseStatus,
          'developing': 'reviewing' as CaseStatus,
          'reviewing': 'pending_code_review' as CaseStatus,
          'pending_code_review': 'testing' as CaseStatus,
          'testing': 'pending_test_review' as CaseStatus,
          'pending_test_review': 'completed' as CaseStatus,
          'completed': 'completed' as CaseStatus,
          'abandoned': 'abandoned' as CaseStatus,
        }
        c.status = (transitions[c.status as string] ?? c.status) as CaseStatus
      } else if (decision.action === 'abandon') {
        c.status = ('abandoned' as CaseStatus)
      }
      return { ...c }
    },
  }
}

export async function mockLoginUser(data: { email: string; password: string }) {
  await delay(MOCK_DELAY, null)
  if (data.email.includes('@')) {
    const payload = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      token_type: 'bearer'
    }
    localStorage.setItem('rv_access_token', payload.access_token)
    localStorage.setItem('rv_refresh_token', payload.refresh_token)
    return payload
  }
  throw new Error('Invalid credentials')
}

export async function mockRegisterUser(data: { username: string; email: string; password: string }) {
  await delay(MOCK_DELAY, null)
  const payload = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    token_type: 'bearer'
  }
  localStorage.setItem('rv_access_token', payload.access_token)
  localStorage.setItem('rv_refresh_token', payload.refresh_token)
  return payload
}
