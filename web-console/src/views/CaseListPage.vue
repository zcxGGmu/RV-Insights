<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CaseStatusBadge from '@/components/CaseStatusBadge.vue'
import { listCases, createCase as apiCreateCase } from '@/api/cases'
import type { Case } from '@/types'

const router = useRouter()
const showNewCase = ref(false)
const cases = ref<Case[]>([])
const loading = ref(false)
const page = ref(1)
const perPage = 6
const filters = ref({ status: '', target_repo: '', sort: 'created_desc' })

const newCase = ref({ title: '', target_repo: '', input_context: '' })

function goToDetail(caseId: string) {
  router.push(`/cases/${caseId}`)
}

async function loadCases() {
  loading.value = true
  const res = await listCases({ page: page.value, per_page: perPage, status: filters.value.status, target_repo: filters.value.target_repo })
  cases.value = res.items ?? []
  loading.value = false
}

async function openNewCase() {
  showNewCase.value = true
}

async function createCase() {
  if (!newCase.value.title || !newCase.value.target_repo) return
  await apiCreateCase({ title: newCase.value.title, target_repo: newCase.value.target_repo, input_context: newCase.value.input_context })
  showNewCase.value = false
  newCase.value = { title: '', target_repo: '', input_context: '' }
  await loadCases()
}

onMounted(loadCases)
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Cases</h1>
      <button class="px-4 py-2 rounded bg-blue-600 text-white" @click="openNewCase">New Case</button>
    </div>

    <div class="flex items-center gap-3">
      <select v-model="filters.status" class="border rounded px-2 py-1">
        <option value="">All statuses</option>
        <option value="exploring">Exploring</option>
        <option value="planning">Planning</option>
        <option value="completed">Completed</option>
      </select>
      <input v-model="filters.target_repo" placeholder="Target repo" class="border rounded px-2 py-1" />
      <select v-model="filters.sort" class="border rounded px-2 py-1">
        <option value="created_desc">Newest</option>
        <option value="created_asc">Oldest</option>
      </select>
    </div>

    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="i in 4" :key="i" class="h-28 bg-white rounded shadow p-4 animate-pulse"></div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="c in cases"
        :key="c.id"
        class="bg-white rounded-lg shadow p-4 flex flex-col cursor-pointer hover:shadow-md transition-shadow"
        @click="goToDetail(c.id)"
      >
        <div class="flex items-start justify-between">
          <h3 class="font-semibold text-lg">{{ c.title }}</h3>
          <CaseStatusBadge :status="c.status" />
        </div>
        <div class="text-sm text-gray-600 mt-2">Target: {{ c.target_repo }}</div>
        <div class="mt-2 text-xs text-gray-500">Created: {{ new Date(c.created_at || '').toLocaleString() }}</div>
      </div>
    </div>

    <div v-if="cases.length === 0" class="text-center text-gray-600 py-8">No cases yet. Create your first case.</div>

    <div class="flex justify-center space-x-2 mt-2">
      <button class="px-3 py-1 rounded border" @click="page = Math.max(1, page - 1); loadCases()">Prev</button>
      <span class="px-3 py-1">Page {{ page }}</span>
      <button class="px-3 py-1 rounded border" @click="page = page + 1; loadCases()">Next</button>
    </div>

    <!-- Simple New Case Modal -->
    <div v-if="showNewCase" class="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-xl font-semibold mb-4">New Case</h3>
        <div class="space-y-2">
          <div>
            <label class="block text-sm">Title</label>
            <input v-model="newCase.title" class="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label class="block text-sm">Target Repo</label>
            <input v-model="newCase.target_repo" class="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label class="block text-sm">Input Context</label>
            <textarea v-model="newCase.input_context" class="w-full border rounded px-2 py-1"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button class="px-3 py-1 rounded border" @click="showNewCase=false">Cancel</button>
          <button class="px-3 py-1 rounded bg-blue-600 text-white" @click="createCase">Create</button>
        </div>
      </div>
    </div>
  </div>
</template>

<!-- Removed duplicate script block to keep a single <script setup> block -->
