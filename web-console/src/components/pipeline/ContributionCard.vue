<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
    <!-- Header: type badge + title -->
    <div class="flex items-start gap-3">
      <span
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
        :class="typeBadgeClasses"
      >
        <Search class="w-3 h-3" />
        {{ result.contribution_type }}
      </span>
      <h3 class="text-sm font-semibold text-gray-900 leading-snug">{{ result.title }}</h3>
    </div>

    <!-- Summary -->
    <p class="text-sm text-gray-600 leading-relaxed">{{ result.summary }}</p>

    <!-- Feasibility score bar -->
    <div class="space-y-1">
      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-500 font-medium">Feasibility</span>
        <span class="font-mono" :class="scoreTextColor">{{ result.feasibility_score.toFixed(2) }}</span>
      </div>
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="scoreBarColor"
          :style="{ width: `${Math.min(result.feasibility_score * 100, 100)}%` }"
        />
      </div>
    </div>

    <!-- Meta grid -->
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div>
        <span class="text-gray-500 text-xs">Repository</span>
        <p class="font-medium text-gray-800 truncate">{{ result.target_repo }}</p>
      </div>
      <div>
        <span class="text-gray-500 text-xs">Complexity</span>
        <p class="font-medium text-gray-800">{{ result.estimated_complexity }}</p>
      </div>
      <div class="col-span-2">
        <span class="text-gray-500 text-xs">Upstream Status</span>
        <p class="font-medium text-gray-800">{{ result.upstream_status }}</p>
      </div>
    </div>

    <!-- Target files (collapsible) -->
    <div v-if="result.target_files.length > 0" class="space-y-1">
      <button
        class="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        @click="filesExpanded = !filesExpanded"
      >
        <component :is="filesExpanded ? ChevronDown : ChevronRight" class="w-3.5 h-3.5" />
        <FileCode class="w-3.5 h-3.5" />
        <span>Target Files ({{ result.target_files.length }})</span>
      </button>
      <ul
        v-if="filesExpanded || result.target_files.length <= 3"
        class="ml-5 space-y-0.5"
      >
        <li
          v-for="file in result.target_files"
          :key="file"
          class="text-xs text-gray-600 font-mono truncate"
        >
          {{ file }}
        </li>
      </ul>
    </div>

    <!-- Evidence chain -->
    <div v-if="result.evidence.length > 0" class="space-y-2">
      <h4 class="text-xs font-medium text-gray-500 uppercase tracking-wide">Evidence</h4>
      <div
        v-for="(ev, idx) in result.evidence"
        :key="idx"
        class="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-1.5"
      >
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-gray-700">{{ ev.source }}</span>
          <span
            class="ml-auto text-xs px-1.5 py-0.5 rounded-full font-mono"
            :class="relevanceBadgeClasses(ev.relevance)"
          >
            {{ ev.relevance.toFixed(2) }}
          </span>
        </div>
        <p class="text-xs text-gray-600 leading-relaxed">
          {{ truncateContent(ev.content) }}
        </p>
        <a
          v-if="ev.url"
          :href="ev.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ExternalLink class="w-3 h-3" />
          <span>View source</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Search,
  FileCode,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-vue-next'
import type { ExplorationResult } from '@/types'

const props = defineProps<{
  result: ExplorationResult
}>()

const filesExpanded = ref(false)

const typeColorMap: Record<string, string> = {
  bugfix: 'bg-orange-100 text-orange-700',
  isa_extension: 'bg-blue-100 text-blue-700',
  documentation: 'bg-green-100 text-green-700',
  optimization: 'bg-purple-100 text-purple-700',
  feature: 'bg-indigo-100 text-indigo-700',
  test: 'bg-teal-100 text-teal-700',
}

const typeBadgeClasses = computed(() => {
  return typeColorMap[props.result.contribution_type] ?? 'bg-gray-100 text-gray-700'
})

const scoreTextColor = computed(() => {
  const s = props.result.feasibility_score
  if (s < 0.3) return 'text-red-600'
  if (s <= 0.7) return 'text-yellow-600'
  return 'text-green-600'
})

const scoreBarColor = computed(() => {
  const s = props.result.feasibility_score
  if (s < 0.3) return 'bg-red-400'
  if (s <= 0.7) return 'bg-yellow-400'
  return 'bg-green-500'
})

function relevanceBadgeClasses(relevance: number): string {
  if (relevance >= 0.7) return 'bg-green-100 text-green-700'
  if (relevance >= 0.4) return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

function truncateContent(content: string): string {
  if (content.length <= 200) return content
  return content.slice(0, 200) + '...'
}
</script>
