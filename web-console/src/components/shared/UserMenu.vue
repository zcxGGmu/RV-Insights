<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsDialog } from '@/composables/useSettingsDialog'
import { Settings, LogOut, User, BarChart3, Brain } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsDialog()

const isOpen = ref(false)
const user = computed(() => auth.user)

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

function openSettings(tab?: Parameters<typeof settings.open>[0]) {
  close()
  settings.open(tab)
}

function logout() {
  close()
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="relative">
    <button
      class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      @click="toggle"
    >
      <div class="flex size-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        {{ user?.username?.charAt(0)?.toUpperCase() || 'U' }}
      </div>
      <span class="max-w-[100px] truncate">{{ user?.username ?? 'Guest' }}</span>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="fixed inset-0 z-40" @click="close" />
    </Teleport>

    <div
      v-if="isOpen"
      class="absolute bottom-full right-0 z-50 mb-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ user?.username }}</p>
        <p class="text-xs text-gray-400">{{ user?.email }}</p>
      </div>

      <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" @click="openSettings('account')">
        <User class="size-4" />
        账户设置
      </button>
      <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" @click="openSettings('models')">
        <Settings class="size-4" />
        模型管理
      </button>
      <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" @click="openSettings('personalization')">
        <Brain class="size-4" />
        个性化
      </button>
      <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" @click="openSettings('statistics')">
        <BarChart3 class="size-4" />
        用量统计
      </button>

      <div class="border-t border-gray-100 dark:border-gray-800">
        <button class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" @click="logout">
          <LogOut class="size-4" />
          退出登录
        </button>
      </div>
    </div>
  </div>
</template>
