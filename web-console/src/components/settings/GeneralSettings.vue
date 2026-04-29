<script setup lang="ts">
import { ref, onMounted } from 'vue'

const theme = ref<'light' | 'dark' | 'system'>('system')
const language = ref('zh')

function saveLanguage(lang: string) {
  localStorage.setItem('rv_language', lang)
}

function applyTheme(value: string) {
  theme.value = value as typeof theme.value
  if (value === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (value === 'light') {
    document.documentElement.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', prefersDark)
  }
  localStorage.setItem('rv_theme', value)
}

onMounted(() => {
  theme.value = (localStorage.getItem('rv_theme') as typeof theme.value) || 'system'
  language.value = localStorage.getItem('rv_language') || 'zh'
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="mb-4 text-base font-medium text-gray-800 dark:text-gray-200">外观</h3>
      <div class="flex gap-3">
        <button
          v-for="opt in [
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' },
            { value: 'system', label: '跟随系统' },
          ]"
          :key="opt.value"
          class="rounded-lg border px-4 py-2 text-sm transition-colors"
          :class="theme === opt.value
            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'"
          @click="applyTheme(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div>
      <h3 class="mb-4 text-base font-medium text-gray-800 dark:text-gray-200">语言</h3>
      <select
        v-model="language"
        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        @change="saveLanguage(language)"
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </div>
  </div>
</template>
