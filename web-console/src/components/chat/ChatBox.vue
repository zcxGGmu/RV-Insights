<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Send, Square, Paperclip } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  isRunning?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  stop: []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isComposing = ref(false)

const input = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
})

const sendEnabled = computed(() => input.value.trim().length > 0 && !props.isRunning)

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

function focus() {
  textareaRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 shadow-sm">
    <div class="flex items-end gap-2 p-3">
      <textarea
        ref="textareaRef"
        v-model="input"
        :placeholder="placeholder || '输入你的问题...'"
        rows="1"
        class="flex-1 resize-none bg-transparent text-sm leading-relaxed text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
        style="max-height: 200px"
        @keydown="handleKeydown"
        @input="handleInput"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
      />
      <button
        v-if="isRunning"
        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
        @click="emit('stop')"
      >
        <Square class="size-3.5" />
      </button>
      <button
        v-else
        :disabled="!sendEnabled"
        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
        @click="emit('submit')"
      >
        <Send class="size-3.5" />
      </button>
    </div>
  </div>
</template>
