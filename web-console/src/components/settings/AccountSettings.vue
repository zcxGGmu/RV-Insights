<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const user = computed(() => auth.user)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="mb-4 text-base font-medium text-gray-800 dark:text-gray-200">账户信息</h3>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm text-gray-500">用户名</label>
          <p class="text-sm text-gray-800 dark:text-gray-200">{{ user?.username ?? '-' }}</p>
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-500">邮箱</label>
          <p class="text-sm text-gray-800 dark:text-gray-200">{{ user?.email ?? '-' }}</p>
        </div>
        <div>
          <label class="mb-1 block text-sm text-gray-500">角色</label>
          <p class="text-sm text-gray-800 dark:text-gray-200">{{ user?.role ?? '-' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
