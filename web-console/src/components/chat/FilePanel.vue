<script setup lang="ts">
import { X, FileText, Image, Code, File as FileIcon } from 'lucide-vue-next'
import type { SessionFile } from '@/composables/useFilePanel'

defineProps<{
  files: SessionFile[]
  selectedFileId: string | null
}>()

const emit = defineEmits<{
  close: []
  select: [fileId: string]
  upload: []
}>()

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return Image
  if (contentType.includes('text') || contentType.includes('json')) return Code
  if (contentType.includes('pdf')) return FileText
  return FileIcon
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="flex h-full flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div class="flex h-10 shrink-0 items-center justify-between border-b border-gray-200 px-3 dark:border-gray-700">
      <div class="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        <FileText class="size-4" />
        文件
      </div>
      <div class="flex items-center gap-1">
        <button
          class="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
          @click="emit('upload')"
        >
          上传
        </button>
        <button
          class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          @click="emit('close')"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="!files.length" class="py-8 text-center text-sm text-gray-400">
        暂无文件
      </div>

      <button
        v-for="f in files"
        :key="f.id"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        :class="{ 'bg-blue-50 dark:bg-blue-900/20': selectedFileId === f.id }"
        @click="emit('select', f.id)"
      >
        <component :is="getFileIcon(f.content_type)" class="size-4 shrink-0 text-gray-400" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-gray-700 dark:text-gray-300">{{ f.original_name }}</p>
          <p class="text-xs text-gray-400">{{ formatSize(f.size) }}</p>
        </div>
      </button>
    </div>
  </div>
</template>
