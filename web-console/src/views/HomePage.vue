<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Cpu, BookOpen, GitBranch, BarChart3 } from 'lucide-vue-next'
import ChatBox from '@/components/chat/ChatBox.vue'
import { useChatStore } from '@/stores/chat'
import { setPendingChat } from '@/composables/usePendingChat'
import { showErrorToast } from '@/utils/toast'

const router = useRouter()
const store = useChatStore()

const message = ref('')
const isSubmitting = ref(false)
const chatBoxRef = ref<InstanceType<typeof ChatBox> | null>(null)

const quickPrompts = [
  {
    icon: Cpu,
    title: 'RISC-V 架构',
    description: '了解 RISC-V 指令集、扩展和微架构设计',
    query: '请介绍 RISC-V 的主要指令集扩展及其应用场景',
  },
  {
    icon: GitBranch,
    title: '开源贡献',
    description: '分析 RISC-V 社区的开源项目和贡献流程',
    query: '如何开始为 RISC-V 开源项目做贡献？有哪些推荐的入门项目？',
  },
  {
    icon: BookOpen,
    title: '技术文档',
    description: '查阅 RISC-V 规范、手册和技术报告',
    query: '请帮我梳理 RISC-V 最新的规范文档和重要的技术提案',
  },
  {
    icon: BarChart3,
    title: '生态分析',
    description: '了解 RISC-V 生态系统的发展趋势和关键参与者',
    query: '分析当前 RISC-V 生态系统的主要参与者和发展趋势',
  },
]

function usePrompt(query: string) {
  message.value = query
  chatBoxRef.value?.focus()
}

async function handleSubmit() {
  if (!message.value.trim() || isSubmitting.value) return
  isSubmitting.value = true

  try {
    const res = await store.createSession('chat')
    if (res.code !== 0) {
      showErrorToast(res.msg || '创建会话失败')
      return
    }
    setPendingChat({ message: message.value, attachments: [] })
    router.push(`/chat/${res.data.session_id}`)
  } catch (e: any) {
    showErrorToast(e.message || '创建会话失败')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center px-4">
    <div class="w-full max-w-2xl">
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          RV-Insights
        </h1>
        <p class="mt-2 text-gray-500 dark:text-gray-400">
          RISC-V 开源贡献智能分析平台
        </p>
      </div>

      <div class="mb-6 grid grid-cols-2 gap-3">
        <button
          v-for="p in quickPrompts"
          :key="p.title"
          class="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-900/20"
          @click="usePrompt(p.query)"
        >
          <component
            :is="p.icon"
            class="mt-0.5 size-5 shrink-0 text-blue-500"
          />
          <div>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ p.title }}</p>
            <p class="mt-0.5 text-xs text-gray-400">{{ p.description }}</p>
          </div>
        </button>
      </div>

      <ChatBox
        ref="chatBoxRef"
        v-model="message"
        placeholder="问我关于 RISC-V 的任何问题..."
        @submit="handleSubmit"
      />
    </div>
  </div>
</template>
