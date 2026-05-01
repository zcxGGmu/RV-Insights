<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Folder, File, FileText, Loader2 } from 'lucide-vue-next'
import { browseSkillFiles, readSkillFile } from '@/api/skills'
import type { FileEntry } from '@/types'

const route = useRoute()
const router = useRouter()
const skillName = route.params.name as string

const files = ref<FileEntry[]>([])
const currentPath = ref('')
const selectedFile = ref('')
const fileContent = ref('')
const loadingFiles = ref(true)
const loadingContent = ref(false)

async function loadFiles(path = '') {
  loadingFiles.value = true
  try {
    const res = await browseSkillFiles(skillName, path)
    if (res.code === 0) {
      files.value = res.data
      currentPath.value = path
    }
  } finally {
    loadingFiles.value = false
  }
}

async function openFile(entry: FileEntry) {
  if (entry.type === 'directory') {
    await loadFiles(entry.path)
    return
  }
  selectedFile.value = entry.path
  loadingContent.value = true
  try {
    const res = await readSkillFile(skillName, entry.path)
    if (res.code === 0) fileContent.value = res.data.content
  } finally {
    loadingContent.value = false
  }
}

function goBack() {
  router.push('/skills')
}

function goUp() {
  if (!currentPath.value) return
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()
  loadFiles(parts.join('/'))
}

function fileIcon(entry: FileEntry) {
  return entry.type === 'directory' ? Folder : FileText
}

onMounted(() => loadFiles())
</script>

<template>
  <div class="mx-auto flex h-full max-w-6xl flex-col px-6 py-8">
    <!-- Header -->
    <div class="mb-6">
      <button
        class="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        @click="goBack"
      >
        <ArrowLeft class="size-4" />
        返回技能列表
      </button>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {{ skillName }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        浏览技能文件与内容
      </p>
    </div>

    <!-- Two-panel layout -->
    <div class="flex min-h-0 flex-1 gap-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
      <!-- Left panel: file tree -->
      <div class="w-1/3 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <!-- Breadcrumb / up button -->
        <div
          v-if="currentPath"
          class="mb-3"
        >
          <button
            class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            @click="goUp"
          >
            <ArrowLeft class="size-3" />
            上级目录
          </button>
          <p class="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">
            {{ currentPath }}
          </p>
        </div>

        <!-- Loading state -->
        <div
          v-if="loadingFiles"
          class="flex items-center justify-center py-12"
        >
          <Loader2 class="size-5 animate-spin text-gray-400" />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="files.length === 0"
          class="py-12 text-center text-sm text-gray-400 dark:text-gray-500"
        >
          此目录为空
        </div>

        <!-- File list -->
        <ul v-else class="space-y-0.5">
          <li
            v-for="entry in files"
            :key="entry.path"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            :class="
              selectedFile === entry.path
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300'
            "
            @click="openFile(entry)"
          >
            <component
              :is="fileIcon(entry)"
              class="size-4 shrink-0"
              :class="
                entry.type === 'directory'
                  ? 'text-yellow-500'
                  : 'text-gray-400 dark:text-gray-500'
              "
            />
            <span class="truncate">{{ entry.name }}</span>
          </li>
        </ul>
      </div>

      <!-- Right panel: file content -->
      <div class="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        <!-- No file selected -->
        <div
          v-if="!selectedFile && !loadingContent"
          class="flex flex-1 items-center justify-center"
        >
          <div class="text-center">
            <File class="mx-auto mb-2 size-8 text-gray-300 dark:text-gray-600" />
            <p class="text-sm text-gray-400 dark:text-gray-500">
              选择文件以查看内容
            </p>
          </div>
        </div>

        <!-- Loading content -->
        <div
          v-else-if="loadingContent"
          class="flex flex-1 items-center justify-center"
        >
          <Loader2 class="size-5 animate-spin text-gray-400" />
        </div>

        <!-- File content viewer -->
        <template v-else>
          <div class="flex items-center border-b border-gray-200 px-4 py-2 dark:border-gray-700">
            <FileText class="mr-2 size-4 text-gray-400" />
            <span class="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ selectedFile }}
            </span>
          </div>
          <div class="flex-1 overflow-auto p-4">
            <pre class="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gray-800 dark:text-gray-200">{{ fileContent }}</pre>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
