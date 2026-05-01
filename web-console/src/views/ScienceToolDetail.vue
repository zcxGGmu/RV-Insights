<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Play, Loader2 } from 'lucide-vue-next'
import { getTUTool, runTUTool } from '@/api/tooluniverse'
import type { TUToolSpec } from '@/types'

const route = useRoute()
const router = useRouter()
const toolName = route.params.name as string

const spec = ref<TUToolSpec | null>(null)
const loading = ref(true)
const formValues = ref<Record<string, string>>({})
const running = ref(false)
const result = ref<any>(null)
const error = ref('')

const paramEntries = computed(() => {
  if (!spec.value?.parameters?.properties) return []
  const props = spec.value.parameters.properties as Record<string, any>
  const requiredList: string[] = spec.value.parameters.required || []
  return Object.entries(props).map(([key, schema]) => ({
    key,
    type: schema.type || 'string',
    description: schema.description || '',
    required: requiredList.includes(key) || !!schema.required,
    enumValues: schema.enum || null,
  }))
})

const testExamples = computed(() => spec.value?.test_examples || [])

const canRun = computed(() => {
  if (!spec.value) return false
  const requiredList: string[] = spec.value.parameters?.required || []
  return requiredList.every(k => formValues.value[k]?.trim())
})

async function loadSpec() {
  loading.value = true
  try {
    spec.value = await getTUTool(toolName)
    const props = spec.value?.parameters?.properties || {}
    const values: Record<string, string> = {}
    for (const key of Object.keys(props)) {
      values[key] = ''
    }
    formValues.value = values
  } catch (e: any) {
    error.value = e?.response?.data?.detail || '加载工具详情失败'
  } finally {
    loading.value = false
  }
}

async function handleRun() {
  if (!spec.value || running.value) return
  running.value = true
  error.value = ''
  result.value = null
  try {
    const args: Record<string, any> = {}
    for (const [k, v] of Object.entries(formValues.value)) {
      if (v.trim()) args[k] = v.trim()
    }
    const data = await runTUTool(toolName, args)
    result.value = data.result
  } catch (e: any) {
    error.value = e?.response?.data?.detail || e.message || '执行失败'
  } finally {
    running.value = false
  }
}

function fillExample(example: Record<string, any>) {
  const values = { ...formValues.value }
  for (const [k, v] of Object.entries(example)) {
    if (k in values) {
      values[k] = String(v)
    }
  }
  formValues.value = values
}

function goBack() {
  router.push('/tools')
}

onMounted(loadSpec)
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <button
        class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        @click="goBack"
      >
        <ArrowLeft class="size-4" />
        返回
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-blue-500" />
    </div>

    <!-- Error loading -->
    <div v-else-if="!spec && error" class="py-12 text-center">
      <p class="text-red-500">{{ error }}</p>
      <button class="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white" @click="loadSpec">重试</button>
    </div>

    <!-- Tool detail -->
    <template v-else-if="spec">
      <!-- Title + category -->
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ spec.name }}</h1>
          <span class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {{ spec.category_zh || spec.category }}
          </span>
        </div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">{{ spec.description }}</p>
      </div>

      <!-- Parameters form -->
      <div class="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">参数</h2>

        <div v-if="paramEntries.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
          此工具无需参数。
        </div>

        <div class="space-y-4">
          <div v-for="param in paramEntries" :key="param.key">
            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ param.key }}
              <span v-if="param.required" class="text-red-500">*</span>
            </label>
            <p v-if="param.description" class="mb-1.5 text-xs text-gray-400">
              {{ param.description }}
            </p>
            <select
              v-if="param.enumValues"
              v-model="formValues[param.key]"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">-- 请选择 --</option>
              <option v-for="opt in param.enumValues" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input
              v-else
              v-model="formValues[param.key]"
              :type="param.type === 'number' || param.type === 'integer' ? 'number' : 'text'"
              :placeholder="`${param.type}`"
              class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        <!-- Run button -->
        <div class="mt-5">
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canRun || running"
            @click="handleRun"
          >
            <Loader2 v-if="running" class="size-4 animate-spin" />
            <Play v-else class="size-4" />
            运行
          </button>
        </div>
      </div>

      <!-- Result -->
      <div v-if="result !== null" class="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/20">
        <h2 class="mb-3 text-lg font-medium text-green-800 dark:text-green-300">执行结果</h2>
        <pre class="overflow-auto whitespace-pre-wrap rounded bg-white p-4 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">{{ typeof result === 'string' ? result : JSON.stringify(result, null, 2) }}</pre>
      </div>

      <!-- Error -->
      <div v-if="error && !loading" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
      </div>

      <!-- Test examples -->
      <div v-if="testExamples.length > 0" class="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 class="mb-3 text-lg font-medium text-gray-900 dark:text-gray-100">测试示例</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(example, idx) in testExamples"
            :key="idx"
            class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/30"
            @click="fillExample(example)"
          >
            示例 {{ idx + 1 }}
          </button>
        </div>
        <div class="mt-3 space-y-2">
          <details v-for="(example, idx) in testExamples" :key="`detail-${idx}`" class="text-sm">
            <summary class="cursor-pointer text-gray-600 dark:text-gray-400">
              示例 {{ idx + 1 }} 详情
            </summary>
            <pre class="mt-1 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{{ JSON.stringify(example, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </template>
  </div>
</template>
