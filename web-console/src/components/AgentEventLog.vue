<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  BrainCircuit,
  Wrench,
  FileCheck,
  AlertTriangle,
  DollarSign,
  MessageSquare,
  Activity
} from 'lucide-vue-next'
import type { PipelineEvent } from '@/types'

const props = defineProps<{
  events: PipelineEvent[]
}>()

interface RenderEvent {
  seq: number
  icon: any
  iconColor: string
  bgColor: string
  title: string
  body?: string
  meta?: string
}

function renderEvent(event: PipelineEvent): RenderEvent {
  const base: RenderEvent = {
    seq: event.seq,
    icon: Activity,
    iconColor: 'text-gray-400',
    bgColor: 'bg-gray-50',
    title: event.event_type,
  }

  switch (event.event_type) {
    case 'stage_change': {
      const stage = event.data.stage || 'unknown'
      const status = event.data.status || 'unknown'
      base.icon = status === 'completed' ? CheckCircle2 : Loader2
      base.iconColor = status === 'completed' ? 'text-green-500' : 'text-blue-500'
      base.bgColor = status === 'completed' ? 'bg-green-50' : 'bg-blue-50'
      base.title = `Stage: ${stage}`
      base.meta = status
      break
    }
    case 'agent_output': {
      const type = event.data.type || 'output'
      if (type === 'thinking') {
        base.icon = BrainCircuit
        base.iconColor = 'text-purple-500'
        base.bgColor = 'bg-purple-50'
        base.title = 'Thinking'
        base.body = event.data.content || ''
      } else if (type === 'tool_call') {
        base.icon = Wrench
        base.iconColor = 'text-orange-500'
        base.bgColor = 'bg-orange-50'
        base.title = `Tool: ${event.data.tool_name || 'unknown'}`
        base.body = JSON.stringify(event.data.args || {}, null, 2)
      } else if (type === 'tool_result') {
        base.icon = FileCheck
        base.iconColor = 'text-teal-500'
        base.bgColor = 'bg-teal-50'
        base.title = `Result: ${event.data.tool_name || 'unknown'}`
        base.body = typeof event.data.result === 'string'
          ? event.data.result
          : JSON.stringify(event.data.result || {}, null, 2)
      } else {
        base.icon = MessageSquare
        base.iconColor = 'text-gray-600'
        base.bgColor = 'bg-gray-50'
        base.title = 'Output'
        base.body = event.data.content || JSON.stringify(event.data, null, 2)
      }
      break
    }
    case 'review_request': {
      base.icon = AlertTriangle
      base.iconColor = 'text-yellow-500'
      base.bgColor = 'bg-yellow-50'
      base.title = 'Review Requested'
      base.body = `Stage: ${event.data.stage || 'current'}`
      break
    }
    case 'cost_update': {
      base.icon = DollarSign
      base.iconColor = 'text-emerald-500'
      base.bgColor = 'bg-emerald-50'
      base.title = 'Cost Update'
      base.body = `$${(event.data.estimated_cost_usd || 0).toFixed(2)}`
      base.meta = `${event.data.total_input_tokens || 0} in / ${event.data.total_output_tokens || 0} out`
      break
    }
    case 'error': {
      base.icon = XCircle
      base.iconColor = 'text-red-500'
      base.bgColor = 'bg-red-50'
      base.title = 'Error'
      base.body = event.data.message || 'Unknown error'
      base.meta = event.data.recoverable ? 'Recoverable' : 'Non-recoverable'
      break
    }
    case 'completed': {
      base.icon = CheckCircle2
      base.iconColor = 'text-green-600'
      base.bgColor = 'bg-green-50'
      base.title = 'Pipeline Completed'
      break
    }
    default:
      base.body = JSON.stringify(event.data, null, 2)
  }

  return base
}

const renderedEvents = computed(() => {
  return [...props.events].reverse().map(renderEvent)
})
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="evt in renderedEvents"
      :key="evt.seq"
      class="rounded-lg border p-3 text-sm"
      :class="evt.bgColor || 'bg-white border-gray-100'"
    >
      <div class="flex items-center gap-2 mb-1">
        <component :is="evt.icon" class="w-4 h-4 shrink-0" :class="evt.iconColor" />
        <span class="font-medium text-gray-700">{{ evt.title }}</span>
        <span v-if="evt.meta" class="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/70 text-gray-500">
          {{ evt.meta }}
        </span>
        <span class="text-xs text-gray-400 font-mono">#{{ evt.seq }}</span>
      </div>
      <pre
        v-if="evt.body"
        class="mt-1 text-xs text-gray-600 whitespace-pre-wrap break-words font-mono bg-white/50 rounded p-2"
      >{{ evt.body }}</pre>
    </div>
  </div>
</template>
