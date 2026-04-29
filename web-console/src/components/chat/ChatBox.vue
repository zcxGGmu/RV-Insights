<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { Send, Square, ChevronDown } from 'lucide-vue-next'
import { listModels, type ModelConfig } from '@/api/models'

const props = defineProps<{
  modelValue: string
  isRunning?: boolean
  placeholder?: string
  modelConfigId?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:modelConfigId': [value: string | null]
  submit: []
  stop: []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isComposing = ref(false)
const models = ref<ModelConfig[]>([])
const showModelPicker = ref(false)

const input = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
})

const sendEnabled = computed(() => input.value.trim().length > 0 && !props.isRunning)

const selectedModel = computed(() =>
  models.value.find((m) => m.id === props.modelConfigId) ?? null,
)

const modelLabel = computed(() => selectedModel.value?.name ?? '默认模型')

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !isComposing.value) {
    e.preventDefault()
    if (sendEnabled.value) emit('submit')
  }
}

function handleInput() {
  nextTick(autoResize)
}

function selectModel(id: string | null) {
  emit('update:modelConfigId', id)
  showModelPicker.value = false
}

function focus() {
  textareaRef.value?.focus()
}

onMounted(async () => {
  const res = await listModels()
  if (res.code === 0) {
    models.value = res.data
  }
})

defineExpose({ focus })
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div class="flex items-end gap-2 p-3">
      <textarea
        ref="textareaRef"
        v-model="input"
        :placeholder="placeholder || '输入你的问题...'"
        rows="1"
        class="flex-1 resize-none bg-transparent text-sm leading-relaxed text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100"
        style="max-height: 200px"
        @keydown="handleKeydown"
        @input="handleInput"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
      />
      <button
        v-if="isRunning"
        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
        @click="emit('stop')"
      >
        <Square class="size-3.5" />
      </button>
      <button
        v-else
        :disabled="!sendEnabled"
        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        @click="emit('submit')"
      >
        <Send class="size-3.5" />
      </button>
    </div>

    <div v-if="models.length > 1" class="flex items-center border-t border-gray-100 px-3 py-1.5 dark:border-gray-800">
      <div class="relative">
        <button
          class="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          @click="showModelPicker = !showModelPicker"
        >
          {{ modelLabel }}
          <ChevronDown class="size-3" />
        </button>

        <div
          v-if="showModelPicker"
          class="absolute bottom-full left-0 z-10 mb-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <button
            class="flex w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
            :class="!modelConfigId ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'"
            @click="selectModel(null)"
          >
            默认模型
          </button>
          <button
            v-for="m in models"
            :key="m.id"
            class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
            :class="modelConfigId === m.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'"
            @click="selectModel(m.id)"
          >
            <span>{{ m.name }}</span>
            <span class="text-gray-400">{{ m.provider }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
