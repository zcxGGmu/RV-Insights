<template>
  <div class="h-screen flex overflow-hidden">
    <aside class="w-64 fixed h-full bg-white border-r flex flex-col">
      <div class="p-4 text-2xl font-bold">RV-Insights</div>
      <nav class="flex-1 px-2 space-y-2">
        <RouterLink to="/" class="block px-3 py-2 rounded hover:bg-gray-100" active-class="bg-gray-200 font-semibold" exact>Cases</RouterLink>
      </nav>
      <div class="p-3 border-t mt-auto flex items-center gap-2">
        <div class="h-8 w-8 rounded-full bg-gray-200" aria-label="avatar" />
        <div class="flex-1 text-sm">
          <div>{{ user?.name ?? 'Guest' }}</div>
          <span class="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800" v-if="user?.role">{{ user?.role }}</span>
        </div>
        <button @click="logout" class="text-xs text-red-600">Logout</button>
      </div>
    </aside>

    <div class="flex-1 ml-64 overflow-auto bg-gray-50">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { RouterLink, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const user = computed(() => auth.user)

function logout() {
  auth.logout()
  router.push('/login')
}
</script>
