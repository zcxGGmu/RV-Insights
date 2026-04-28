<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SessionPanel from '@/components/chat/SessionPanel.vue'
import { ToastContainer } from '@/components/ui/toast'
import { LogOut } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const user = computed(() => auth.user)

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <SessionPanel />

    <div class="flex flex-1 flex-col overflow-hidden">
      <header class="flex h-12 shrink-0 items-center justify-end border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ user?.username ?? 'Guest' }}</span>
          <button
            class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            @click="logout"
          >
            <LogOut class="size-3.5" />
            退出
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-hidden">
        <router-view />
      </main>
    </div>

    <ToastContainer />
  </div>
</template>
