<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Loader2, Save } from 'lucide-vue-next'
import { getMemory, updateMemory } from '@/api/memory'

const content = ref('')
const loading = ref(false)
const saving = ref(false)
const saved = ref(false)

async function fetchMemory() {
  loading.value = true
  try {
    const res = await getMemory()
    if (res.code === 0) {
      content.value = res.data.content
    }
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  saved.value = false
  try {
    const res = await updateMemory(content.value)
    if (res.code === 0) {
      saved.value = true
      setTimeout(() => { saved.value = false }, 2000)
    }
  } finally {
    saving.value = false
  }
}

onMounted(fetchMemory)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h3 class="mb-2 text-base font-medium text-gray-800 dark:text-gray-200">个性化记忆</h3>
      <p class="text-sm text-gray-500">
        AI 助手会参考这些信息来个性化回复。使用 Markdown 格式编写。
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <Loader2 class="size-5 animate-spin text-gray-400" />
    </div>

    <template v-else>
      <textarea
        v-model="content"
        rows="16"
        class="w-full rounded-lg border border-gray-200 bg-white p-4 font-mono text-sm leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        placeholder="## User Preferences&#10;&#10;## General Patterns&#10;&#10;## Notes"
      />

      <div class="flex items-center justify-end gap-2">
        <span v-if="saved" class="text-xs text-green-500">已保存</span>
        <button
          class="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="saving"
          @click="handleSave"
        >
          <Loader2 v-if="saving" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
          保存
        </button>
      </div>
    </template>
  </div>
</template>
