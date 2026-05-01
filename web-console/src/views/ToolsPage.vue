<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Wrench, Shield, ShieldOff, Trash2, Search, Beaker } from 'lucide-vue-next'
import { listTUTools, listTUCategories } from '@/api/tooluniverse'
import { listTools, blockTool, deleteTool, readToolFile } from '@/api/tools'
import type { TUToolListItem, ExternalToolItem, TUCategory } from '@/types'

const router = useRouter()
const activeTab = ref<'universe' | 'external'>('universe')

// ToolUniverse state
const tuTools = ref<TUToolListItem[]>([])
const tuCategories = ref<TUCategory[]>([])
const searchQuery = ref('')
const selectedCategory = ref('')
const loadingTU = ref(true)

// External tools state
const extTools = ref<ExternalToolItem[]>([])
const loadingExt = ref(true)

// Source code modal
const showSourceModal = ref(false)
const sourceContent = ref('')
const sourceName = ref('')

async function loadTUTools() {
  loadingTU.value = true
  try {
    const params: Record<string, string> = {}
    if (searchQuery.value) params.search = searchQuery.value
    if (selectedCategory.value) params.category = selectedCategory.value
    const data = await listTUTools(params)
    tuTools.value = data.tools || []
  } finally {
    loadingTU.value = false
  }
}

async function loadCategories() {
  try {
    const data = await listTUCategories()
    tuCategories.value = data.categories || []
  } catch {
    tuCategories.value = []
  }
}

async function loadExtTools() {
  loadingExt.value = true
  try {
    const res = await listTools()
    if (res.code === 0) extTools.value = res.data
  } finally {
    loadingExt.value = false
  }
}

async function toggleBlockTool(tool: ExternalToolItem) {
  try {
    const res = await blockTool(tool.name, !tool.blocked)
    if (res.code === 0) {
      extTools.value = extTools.value.map(t =>
        t.name === tool.name ? { ...t, blocked: !t.blocked } : t,
      )
    }
  } catch {
    // silently fail
  }
}

async function handleDeleteTool(tool: ExternalToolItem) {
  if (!confirm(`确定删除工具 "${tool.name}"？`)) return
  try {
    const res = await deleteTool(tool.name)
    if (res.code === 0) {
      extTools.value = extTools.value.filter(t => t.name !== tool.name)
    }
  } catch {
    // silently fail
  }
}

async function viewExtToolSource(tool: ExternalToolItem) {
  try {
    const res = await readToolFile(tool.name)
    if (res.code === 0) {
      sourceName.value = tool.name
      sourceContent.value = res.data.content
      showSourceModal.value = true
    }
  } catch {
    // silently fail
  }
}

function viewTUTool(name: string) {
  router.push(`/tools/science/${name}`)
}

function handleSearch() {
  loadTUTools()
}

onMounted(async () => {
  await Promise.all([loadTUTools(), loadCategories(), loadExtTools()])
})
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center gap-3">
      <Wrench class="size-6 text-blue-500" />
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Tools</h1>
    </div>

    <!-- Tab bar -->
    <div class="flex border-b border-gray-200 dark:border-gray-700">
      <button
        class="px-4 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'universe'
          ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
        @click="activeTab = 'universe'"
      >
        <Beaker class="mr-1.5 inline size-4" />
        ToolUniverse
      </button>
      <button
        class="px-4 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'external'
          ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
        @click="activeTab = 'external'"
      >
        <Wrench class="mr-1.5 inline size-4" />
        External Tools
      </button>
    </div>

    <!-- ToolUniverse tab -->
    <template v-if="activeTab === 'universe'">
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            v-model="searchQuery"
            placeholder="搜索工具..."
            class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            @keyup.enter="handleSearch"
          />
        </div>
        <select
          v-model="selectedCategory"
          class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          @change="loadTUTools"
        >
          <option value="">全部分类</option>
          <option v-for="cat in tuCategories" :key="cat.name" :value="cat.name">
            {{ cat.name_zh || cat.name }} ({{ cat.count }})
          </option>
        </select>
        <button
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          @click="handleSearch"
        >
          搜索
        </button>
      </div>

      <div v-if="loadingTU" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="h-32 animate-pulse rounded-lg bg-white shadow dark:bg-gray-800" />
      </div>

      <div v-else-if="tuTools.length === 0" class="py-12 text-center text-gray-500 dark:text-gray-400">
        未找到工具，请尝试其他搜索条件。
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="tool in tuTools"
          :key="tool.name"
          class="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
          @click="viewTUTool(tool.name)"
        >
          <div class="flex items-start justify-between">
            <h3 class="font-medium text-gray-900 dark:text-gray-100">{{ tool.name }}</h3>
            <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {{ tool.category_zh || tool.category }}
            </span>
          </div>
          <p class="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
            {{ tool.description }}
          </p>
          <div class="mt-3 flex items-center gap-3 text-xs text-gray-400">
            <span>{{ tool.param_count }} 参数</span>
            <span v-if="tool.has_examples" class="text-green-500">有示例</span>
          </div>
        </div>
      </div>
    </template>

    <!-- External Tools tab -->
    <template v-if="activeTab === 'external'">
      <div v-if="loadingExt" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 4" :key="i" class="h-32 animate-pulse rounded-lg bg-white shadow dark:bg-gray-800" />
      </div>

      <div v-else-if="extTools.length === 0" class="py-12 text-center text-gray-500 dark:text-gray-400">
        暂无外部工具。
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="tool in extTools"
          :key="tool.name"
          class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <div class="flex items-start justify-between">
            <h3 class="font-medium text-gray-900 dark:text-gray-100">{{ tool.name }}</h3>
            <span
              v-if="tool.blocked"
              class="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300"
            >
              已屏蔽
            </span>
          </div>
          <p class="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
            {{ tool.description }}
          </p>
          <p class="mt-1 truncate text-xs text-gray-400">{{ tool.file }}</p>
          <div class="mt-3 flex items-center gap-2">
            <button
              class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
              :class="tool.blocked
                ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'"
              @click="toggleBlockTool(tool)"
            >
              <ShieldOff v-if="tool.blocked" class="size-3.5" />
              <Shield v-else class="size-3.5" />
              {{ tool.blocked ? '解除屏蔽' : '屏蔽' }}
            </button>
            <button
              class="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300"
              @click="viewExtToolSource(tool)"
            >
              查看源码
            </button>
            <button
              class="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
              @click="handleDeleteTool(tool)"
            >
              <Trash2 class="size-3.5" />
              删除
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Source code modal -->
    <div v-if="showSourceModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="mx-4 max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ sourceName }}</h3>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            @click="showSourceModal = false"
          >
            &times;
          </button>
        </div>
        <div class="overflow-auto p-6" style="max-height: 60vh">
          <pre class="whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">{{ sourceContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
