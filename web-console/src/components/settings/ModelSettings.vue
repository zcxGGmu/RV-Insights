<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-vue-next'
import {
  listModels,
  createModel,
  updateModel,
  deleteModel,
  detectContextWindow,
  type ModelConfig,
  type CreateModelPayload,
} from '@/api/models'

const models = ref<ModelConfig[]>([])
const loading = ref(false)
const showForm = ref(false)
const editingId = ref<string | null>(null)

const form = ref<CreateModelPayload>({
  name: '',
  provider: 'openai',
  base_url: '',
  api_key: '',
  model_name: '',
  context_window: 128000,
  temperature: 0.7,
})

const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
]

const saving = ref(false)
const error = ref('')

async function fetchModels() {
  loading.value = true
  try {
    const res = await listModels()
    if (res.code === 0) {
      models.value = res.data
    }
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.value = {
    name: '',
    provider: 'openai',
    base_url: '',
    api_key: '',
    model_name: '',
    context_window: 128000,
    temperature: 0.7,
  }
  editingId.value = null
  showForm.value = false
  error.value = ''
}

function startEdit(model: ModelConfig) {
  form.value = {
    name: model.name,
    provider: model.provider,
    base_url: model.base_url || '',
    api_key: '',
    model_name: model.model_name,
    context_window: model.context_window,
    temperature: model.temperature,
  }
  editingId.value = model.id
  showForm.value = true
}

async function handleDetectWindow() {
  const res = await detectContextWindow({
    provider: form.value.provider,
    model_name: form.value.model_name,
  })
  if (res.code === 0) {
    form.value = { ...form.value, context_window: res.data.context_window }
  }
}

async function handleSave() {
  if (!form.value.name || !form.value.model_name) {
    error.value = '请填写名称和模型 ID'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const payload = {
      ...form.value,
      base_url: form.value.base_url || undefined,
      api_key: form.value.api_key || undefined,
    }
    const res = editingId.value
      ? await updateModel(editingId.value, payload)
      : await createModel(payload)
    if (res.code === 0) {
      resetForm()
      await fetchModels()
    } else {
      error.value = res.msg || '保存失败'
    }
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  const res = await deleteModel(id)
  if (res.code === 0) {
    await fetchModels()
  }
}

onMounted(fetchModels)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-medium text-gray-800 dark:text-gray-200">模型配置</h3>
      <button
        v-if="!showForm"
        class="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
        @click="showForm = true"
      >
        <Plus class="size-3.5" />
        添加模型
      </button>
    </div>

    <div v-if="showForm" class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="mb-1 block text-xs text-gray-500">名称</label>
          <input v-model="form.name" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="My GPT-4o" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">提供商</label>
          <select v-model="form.provider" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <option v-for="p in providers" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">模型 ID</label>
          <input v-model="form.model_name" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="gpt-4o" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">Base URL（可选）</label>
          <input v-model="form.base_url" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">API Key</label>
          <input v-model="form.api_key" type="password" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" placeholder="sk-..." />
        </div>
        <div>
          <label class="mb-1 flex items-center gap-2 text-xs text-gray-500">
            Context Window
            <button class="text-blue-500 hover:underline" @click="handleDetectWindow">自动检测</button>
          </label>
          <input v-model.number="form.context_window" type="number" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">Temperature</label>
          <input v-model.number="form.temperature" type="number" step="0.1" min="0" max="2" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" />
        </div>
      </div>

      <p v-if="error" class="mt-2 text-xs text-red-500">{{ error }}</p>

      <div class="mt-4 flex justify-end gap-2">
        <button class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400" @click="resetForm">
          取消
        </button>
        <button
          class="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="saving"
          @click="handleSave"
        >
          <Loader2 v-if="saving" class="size-3.5 animate-spin" />
          <Check v-else class="size-3.5" />
          {{ editingId ? '更新' : '创建' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <Loader2 class="size-5 animate-spin text-gray-400" />
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="model in models"
        :key="model.id"
        class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
      >
        <div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ model.name }}</span>
            <span v-if="model.is_system" class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-800">系统</span>
            <span class="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">{{ model.provider }}</span>
          </div>
          <p class="mt-0.5 text-xs text-gray-500">{{ model.model_name }} · {{ (model.context_window / 1000).toFixed(0) }}K</p>
        </div>
        <div v-if="!model.is_system" class="flex items-center gap-1">
          <button class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800" @click="startEdit(model)">
            <Pencil class="size-3.5" />
          </button>
          <button class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" @click="handleDelete(model.id)">
            <Trash2 class="size-3.5" />
          </button>
        </div>
      </div>

      <p v-if="!models.length && !loading" class="py-4 text-center text-sm text-gray-400">
        暂无模型配置
      </p>
    </div>
  </div>
</template>
