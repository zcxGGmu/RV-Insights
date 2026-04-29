import { ref } from 'vue'

export type SettingsTab =
  | 'account'
  | 'general'
  | 'models'
  | 'personalization'
  | 'statistics'
  | 'notifications'

const isOpen = ref(false)
const activeTab = ref<SettingsTab>('general')

export function useSettingsDialog() {
  function open(tab?: SettingsTab) {
    if (tab) {
      activeTab.value = tab
    }
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return {
    isOpen,
    activeTab,
    open,
    close,
  }
}
