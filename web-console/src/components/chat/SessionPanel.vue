<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Plus, Search, X, Pin, PinOff, Pencil, Trash2,
  MessageSquare, ChevronDown, ChevronRight, Share2, Link2Off,
  BookOpen, Wrench, GitBranch,
} from 'lucide-vue-next'
import { useChatStore } from '@/stores/chat'
import { useSessionGrouping, type FilterType } from '@/composables/useSessionGrouping'
import { useSessionNotifications } from '@/composables/useSessionNotifications'
import { shareSession, unshareSession } from '@/api/chat'
import { formatCustomTime } from '@/utils/time'
import { showErrorToast } from '@/utils/toast'

const router = useRouter()
const route = useRoute()
const store = useChatStore()

const { groupedSessions, searchQuery, activeFilter, stats, setFilter, setSearchQuery, toggleGroupCollapse } =
  useSessionGrouping(() => store.sortedSessions)

const { onSessionCreated, onSessionUpdated } = useSessionNotifications()

const editingId = ref<string | null>(null)
const editTitle = ref('')

onMounted(() => {
  store.fetchSessions()
})

onSessionCreated(() => store.fetchSessions())
onSessionUpdated(() => store.fetchSessions())

async function handleNewChat() {
  try {
    const res = await store.createSession('chat')
    if (res.code === 0) {
      router.push(`/chat/${res.data.session_id}`)
    }
  } catch (e: any) {
    showErrorToast(e?.response?.data?.detail || e?.message || '创建会话失败')
  }
}

function handleSessionClick(sessionId: string) {
  router.push(`/chat/${sessionId}`)
}

async function handlePin(sessionId: string, pinned: boolean) {
  await store.pinSession(sessionId, !pinned)
}

function startRename(sessionId: string, currentTitle: string | null) {
  editingId.value = sessionId
  editTitle.value = currentTitle || ''
}

async function finishRename(sessionId: string) {
  if (editTitle.value.trim()) {
    await store.renameSession(sessionId, editTitle.value.trim())
  }
  editingId.value = null
}

async function handleDelete(sessionId: string) {
  await store.removeSession(sessionId)
  if (route.params.id === sessionId) {
    router.push('/')
  }
}

async function handleToggleShare(sessionId: string, isShared: boolean) {
  if (isShared) {
    await unshareSession(sessionId)
  } else {
    const res = await shareSession(sessionId)
    if (res.code === 0 && res.data.share_url) {
      await navigator.clipboard.writeText(window.location.origin + res.data.share_url)
    }
  }
  await store.fetchSessions()
}

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pinned', label: '置顶' },
  { key: 'running', label: '进行中' },
]
</script>

<template>
  <div class="flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
    <div class="flex items-center justify-between p-3">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">会话</span>
      <button
        class="flex size-7 items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-gray-800"
        @click="handleNewChat"
      >
        <Plus class="size-4 text-gray-500" />
      </button>
    </div>

    <div class="px-3 pb-2">
      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
        <input
          :value="searchQuery"
          placeholder="搜索会话..."
          class="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-8 text-xs dark:border-gray-700 dark:bg-gray-800"
          @input="setSearchQuery(($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="searchQuery"
          class="absolute right-2 top-1/2 -translate-y-1/2"
          @click="setSearchQuery('')"
        >
          <X class="size-3.5 text-gray-400" />
        </button>
      </div>
    </div>

    <div class="flex gap-1 px-3 pb-2">
      <button
        v-for="f in filters"
        :key="f.key"
        class="rounded-md px-2 py-1 text-xs transition-colors"
        :class="activeFilter === f.key
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
          : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800'"
        @click="setFilter(f.key)"
      >
        {{ f.label }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-2">
      <div v-for="group in groupedSessions" :key="group.key" class="mb-1">
        <button
          class="flex w-full items-center gap-1 px-1 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-400"
          @click="toggleGroupCollapse(group.key)"
        >
          <ChevronDown v-if="!group.collapsed" class="size-3" />
          <ChevronRight v-else class="size-3" />
          {{ group.label }}
        </button>

        <div v-if="!group.collapsed">
          <div
            v-for="s in group.sessions"
            :key="s.session_id"
            class="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-800"
            :class="route.params.id === s.session_id ? 'bg-gray-200 dark:bg-gray-800' : ''"
            @click="handleSessionClick(s.session_id)"
          >
            <MessageSquare class="size-4 shrink-0 text-gray-400" />
            <div class="min-w-0 flex-1">
              <div v-if="editingId === s.session_id" class="flex gap-1" @click.stop>
                <input
                  v-model="editTitle"
                  class="w-full rounded border px-1 text-xs dark:bg-gray-800"
                  @keydown.enter="finishRename(s.session_id)"
                  @blur="finishRename(s.session_id)"
                />
              </div>
              <template v-else>
                <p class="truncate text-xs text-gray-700 dark:text-gray-300">
                  {{ s.title || s.latest_message || '新会话' }}
                </p>
                <p class="text-[10px] text-gray-400">
                  {{ s.latest_message_at ? formatCustomTime(s.latest_message_at) : '' }}
                </p>
              </template>
            </div>

            <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100" @click.stop>
              <button
                class="rounded p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700"
                :title="s.is_shared ? '取消分享' : '分享'"
                @click="handleToggleShare(s.session_id, s.is_shared)"
              >
                <Link2Off v-if="s.is_shared" class="size-3 text-blue-400" />
                <Share2 v-else class="size-3 text-gray-400" />
              </button>
              <button
                class="rounded p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700"
                @click="handlePin(s.session_id, s.pinned)"
              >
                <PinOff v-if="s.pinned" class="size-3 text-gray-400" />
                <Pin v-else class="size-3 text-gray-400" />
              </button>
              <button
                class="rounded p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700"
                @click="startRename(s.session_id, s.title)"
              >
                <Pencil class="size-3 text-gray-400" />
              </button>
              <button
                class="rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30"
                @click="handleDelete(s.session_id)"
              >
                <Trash2 class="size-3 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="groupedSessions.length === 0" class="px-4 py-8 text-center text-xs text-gray-400">
        {{ searchQuery ? '没有匹配的会话' : '暂无会话' }}
      </div>
    </div>

    <div class="border-t border-gray-200 p-2 dark:border-gray-700">
      <router-link
        to="/cases"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <GitBranch class="size-4" />
        Pipeline
      </router-link>
      <router-link
        to="/skills"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <BookOpen class="size-4" />
        Skills
      </router-link>
      <router-link
        to="/tools"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <Wrench class="size-4" />
        Tools
      </router-link>
    </div>
  </div>
</template>
