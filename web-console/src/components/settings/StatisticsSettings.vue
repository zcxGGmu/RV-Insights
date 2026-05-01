<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { getSummary, getModelStats, getTrends, type StatsSummary, type ModelStat, type TrendPoint } from '@/api/statistics'

type SubTab = 'overview' | 'models' | 'trends'

const activeSubTab = ref<SubTab>('overview')
const days = ref(30)
const loading = ref(false)

const summary = ref<StatsSummary | null>(null)
const modelStats = ref<ModelStat[]>([])
const trends = ref<TrendPoint[]>([])

async function fetchData() {
  loading.value = true
  try {
    const [sumRes, modRes, trendRes] = await Promise.all([
      getSummary(days.value),
      getModelStats(days.value),
      getTrends(days.value),
    ])
    if (sumRes.code === 0) summary.value = sumRes.data
    if (modRes.code === 0) modelStats.value = modRes.data.models
    if (trendRes.code === 0) trends.value = trendRes.data.trends
  } finally {
    loading.value = false
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function changeDays(d: number) {
  days.value = d
  fetchData()
}

onMounted(fetchData)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex gap-1">
        <button
          v-for="tab in [
            { id: 'overview' as SubTab, label: '概览' },
            { id: 'models' as SubTab, label: '模型' },
            { id: 'trends' as SubTab, label: '趋势' },
          ]"
          :key="tab.id"
          class="rounded-lg px-3 py-1.5 text-xs transition-colors"
          :class="activeSubTab === tab.id
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'"
          @click="activeSubTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="flex gap-1">
        <button
          v-for="d in [7, 30, 90]"
          :key="d"
          class="rounded px-2 py-1 text-xs"
          :class="days === d ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' : 'text-gray-400 hover:text-gray-600'"
          @click="changeDays(d)"
        >
          {{ d }}天
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <Loader2 class="size-5 animate-spin text-gray-400" />
    </div>

    <template v-else>
      <div v-if="activeSubTab === 'overview' && summary" class="grid grid-cols-2 gap-4">
        <div v-for="stat in [
          { label: '会话数', value: summary.total_sessions },
          { label: '总 Token', value: formatNumber(summary.total_tokens) },
          { label: '输入 Token', value: formatNumber(summary.total_input_tokens) },
          { label: '输出 Token', value: formatNumber(summary.total_output_tokens) },
          { label: '工具调用', value: summary.total_tool_calls },
          { label: '总耗时', value: `${(summary.total_duration_ms / 1000).toFixed(1)}s` },
          { label: '成本 (USD)', value: `$${(summary.cost_usd ?? 0).toFixed(4)}` },
          { label: '成本 (CNY)', value: `¥${(summary.cost_cny ?? 0).toFixed(4)}` },
        ]" :key="stat.label" class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <p class="text-xs text-gray-500">{{ stat.label }}</p>
          <p class="mt-1 text-xl font-semibold text-gray-800 dark:text-gray-200">{{ stat.value }}</p>
        </div>
      </div>

      <div v-if="activeSubTab === 'models'" class="space-y-2">
        <div
          v-for="(m, i) in modelStats"
          :key="m.model_config_id ?? `model-${i}`"
          class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <div>
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ m.model_config_id || '默认模型' }}</p>
            <p class="text-xs text-gray-500">{{ m.session_count }} 会话</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ formatNumber(m.total_tokens) }} tokens</p>
            <p class="text-xs text-gray-500">{{ (m.total_duration_ms / 1000).toFixed(1) }}s · ${{ (m.cost_usd ?? 0).toFixed(4) }}</p>
          </div>
        </div>
        <p v-if="!modelStats.length" class="py-4 text-center text-sm text-gray-400">暂无数据</p>
      </div>

      <div v-if="activeSubTab === 'trends'" class="space-y-2">
        <div
          v-for="t in trends"
          :key="t.date"
          class="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 dark:border-gray-700"
        >
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ t.date }}</span>
          <div class="flex items-center gap-4 text-xs text-gray-500">
            <span>{{ t.session_count }} 会话</span>
            <span>{{ formatNumber(t.total_tokens) }} tokens</span>
          </div>
        </div>
        <p v-if="!trends.length" class="py-4 text-center text-sm text-gray-400">暂无数据</p>
      </div>
    </template>
  </div>
</template>
