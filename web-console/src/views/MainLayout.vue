<script setup lang="ts">
import SessionPanel from '@/components/chat/SessionPanel.vue'
import UserMenu from '@/components/shared/UserMenu.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { ToastContainer } from '@/components/ui/toast'
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <SessionPanel />

    <div class="flex flex-1 flex-col overflow-hidden">
      <header class="flex h-12 shrink-0 items-center justify-end border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
        <UserMenu />
      </header>

      <main class="flex-1 overflow-hidden">
        <router-view />
      </main>
    </div>

    <SettingsDialog />
    <ToastContainer />
  </div>
</template>
