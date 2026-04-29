<script setup lang="ts">
import { ToastContainer } from '@/components/ui/toast'
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
    <header class="flex h-12 shrink-0 items-center border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-900">
      <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">RV-Insights</span>
      <span class="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">共享</span>
    </header>

    <main class="flex-1 overflow-hidden">
      <router-view />
    </main>

    <ToastContainer />
  </div>
</template>
