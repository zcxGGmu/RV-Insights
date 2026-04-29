import { ref } from 'vue'

export type RightPanelType = 'tool' | 'file' | null

const panelType = ref<RightPanelType>(null)
const panelData = ref<Record<string, any>>({})

export function useRightPanel() {
  function openPanel(type: RightPanelType, data: Record<string, any> = {}) {
    panelType.value = type
    panelData.value = data
  }

  function closePanel() {
    panelType.value = null
    panelData.value = {}
  }

  function togglePanel(type: RightPanelType, data: Record<string, any> = {}) {
    if (panelType.value === type) {
      closePanel()
    } else {
      openPanel(type, data)
    }
  }

  return {
    panelType,
    panelData,
    openPanel,
    closePanel,
    togglePanel,
  }
}
