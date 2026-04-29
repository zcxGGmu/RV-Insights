<script setup lang="ts">
import { useSettingsDialog, type SettingsTab } from '@/composables/useSettingsDialog'
import { X, User, Settings, Cpu, Brain, BarChart3, Bell } from 'lucide-vue-next'
import AccountSettings from './AccountSettings.vue'
import GeneralSettings from './GeneralSettings.vue'
import ModelSettings from './ModelSettings.vue'
import PersonalizationSettings from './PersonalizationSettings.vue'
import StatisticsSettings from './StatisticsSettings.vue'
import NotificationSettings from './NotificationSettings.vue'

const { isOpen, activeTab, close } = useSettingsDialog()

const tabs: { id: SettingsTab; label: string; icon: any }[] = [
  { id: 'account', label: '账户', icon: User },
  { id: 'general', label: '通用', icon: Settings },
  { id: 'models', label: '模型', icon: Cpu },
  { id: 'personalization', label: '个性化', icon: Brain },
  { id: 'statistics', label: '统计', icon: BarChart3 },
  { id: 'notifications', label: '通知', icon: Bell },
]

function selectTab(id: SettingsTab) {
  activeTab.value = id
}

const tabComponents: Record<SettingsTab, any> = {
  account: AccountSettings,
  general: GeneralSettings,
  models: ModelSettings,
  personalization: PersonalizationSettings,
  statistics: StatisticsSettings,
  notifications: NotificationSettings,
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="close" />

      <div class="relative flex h-[80vh] w-[900px] max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        <aside class="flex w-48 shrink-0 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
          <div class="flex h-12 items-center px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            设置
          </div>
          <nav class="flex-1 space-y-0.5 px-2 py-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
              :class="activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'"
              @click="selectTab(tab.id)"
            >
              <component :is="tab.icon" class="size-4" />
              {{ tab.label }}
            </button>
          </nav>
        </aside>

        <div class="flex flex-1 flex-col overflow-hidden">
          <div class="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
            <h2 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ tabs.find(t => t.id === activeTab)?.label }}
            </h2>
            <button
              class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              @click="close"
            >
              <X class="size-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <component :is="tabComponents[activeTab]" />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
