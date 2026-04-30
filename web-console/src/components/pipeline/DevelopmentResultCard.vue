<script setup lang="ts">
import { ref, computed, defineAsyncComponent, defineComponent, h } from 'vue'
import { GitCommitHorizontal, Plus, Minus, FileCode2, ChevronDown, ChevronRight } from 'lucide-vue-next'
import type { DevelopmentResult } from '@/types'

const DiffViewerLoading = defineComponent({
  render: () => h('div', { class: 'h-[400px] flex items-center justify-center text-sm text-gray-400' }, 'Loading diff viewer...'),
})

const DiffViewerError = defineComponent({
  render: () => h('div', { class: 'h-[400px] flex items-center justify-center text-sm text-red-500' }, 'Failed to load diff viewer. Please refresh.'),
})

const DiffViewer = defineAsyncComponent({
  loader: () => import('./DiffViewer.vue'),
  loadingComponent: DiffViewerLoading,
  errorComponent: DiffViewerError,
  delay: 200,
  timeout: 15000,
})

const props = defineProps<{
  result: DevelopmentResult
}>()

const expandedFiles = ref<Set<string>>(new Set())

const patchEntries = computed(() => {
  const patches = props.result.patches ?? {}
  return Object.entries(patches)
})

function toggleFile(filename: string) {
  const next = new Set(expandedFiles.value)
  if (next.has(filename)) {
    next.delete(filename)
  } else {
    next.add(filename)
  }
  expandedFiles.value = next
}
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
      <div class="flex items-center gap-2">
        <GitCommitHorizontal class="w-4 h-4 text-gray-500" />
        <h3 class="text-sm font-semibold text-gray-700">Development Result</h3>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Commit message -->
      <div class="font-mono text-sm bg-gray-50 rounded px-3 py-2 text-gray-800">
        {{ result.commit_message }}
      </div>

      <!-- Stats -->
      <div class="flex items-center gap-4 text-sm">
        <span class="flex items-center gap-1 text-green-600">
          <Plus class="w-3.5 h-3.5" />{{ result.lines_added }}
        </span>
        <span class="flex items-center gap-1 text-red-600">
          <Minus class="w-3.5 h-3.5" />{{ result.lines_removed }}
        </span>
        <span class="flex items-center gap-1 text-gray-500">
          <FileCode2 class="w-3.5 h-3.5" />{{ result.changed_files?.length ?? 0 }} files
        </span>
      </div>

      <!-- Change summary -->
      <p class="text-sm text-gray-600">{{ result.change_summary }}</p>

      <!-- Patch files -->
      <div v-if="patchEntries.length" class="space-y-2">
        <div v-for="[filename, patch] in patchEntries" :key="filename">
          <button
            class="flex items-center gap-2 w-full text-left text-sm font-mono px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
            :aria-expanded="expandedFiles.has(filename)"
            @click="toggleFile(filename)"
          >
            <component :is="expandedFiles.has(filename) ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-gray-400" />
            <span class="text-blue-600 truncate">{{ filename }}</span>
          </button>
          <div v-if="expandedFiles.has(filename)" class="mt-1 ml-2">
            <DiffViewer
              :original="patch.original_content ?? ''"
              :modified="patch.modified_content ?? ''"
              :filename="filename"
              :language="patch.language ?? 'c'"
            />
          </div>
        </div>
      </div>

      <!-- Fallback: file list without patches -->
      <div v-else-if="result.changed_files?.length" class="space-y-1">
        <div
          v-for="file in result.changed_files"
          :key="file"
          class="text-sm font-mono text-gray-600 px-2 py-1"
        >
          {{ file }}
        </div>
      </div>
    </div>
  </div>
</template>
