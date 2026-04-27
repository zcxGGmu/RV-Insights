import type { Case } from '@/types'

type CaseStatus = Case['status']

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
  }
}

export async function mockLoginUser(data: { email: string; password: string }) {
  await delay(MOCK_DELAY, null)
  if (data.email.includes('@')) {
    return {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      token_type: 'bearer'
    }
  }
  throw new Error('Invalid credentials')
}

export async function mockRegisterUser(data: { username: string; email: string; password: string }) {
  await delay(MOCK_DELAY, null)
  return {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    token_type: 'bearer'
  }
}
