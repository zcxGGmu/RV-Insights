<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next'

interface ToastItem {
  id: number
  message: string
  type: 'error' | 'info' | 'success'
  duration: number
}

const toasts = ref<ToastItem[]>([])
let nextId = 0

function addToast(e: Event) {
  const { message, type, duration } = (e as CustomEvent).detail
  const id = nextId++
  toasts.value = [...toasts.value, { id, message, type, duration }]
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

const iconMap = { success: CheckCircle2, error: AlertCircle, info: Info }
const colorMap = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

onMounted(() => window.addEventListener('toast', addToast))
onUnmounted(() => window.removeEventListener('toast', addToast))
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg', colorMap[toast.type]]"
        >
          <component :is="iconMap[toast.type]" class="size-5 shrink-0 mt-0.5" />
          <span class="text-sm flex-1">{{ toast.message }}</span>
          <button
            class="shrink-0 p-0.5 rounded hover:bg-black/5"
            @click="removeToast(toast.id)"
          >
            <X class="size-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { transition: all 0.3s ease-out; }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(100%); }
.toast-leave-to { opacity: 0; transform: translateX(100%); }
</style>
