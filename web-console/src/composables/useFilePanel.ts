import { ref, computed } from 'vue'
import { getSessionFiles, uploadFile } from '@/api/chat'

export interface SessionFile {
  id: string
  original_name: string
  size: number
  content_type: string
  created_at: string
}

export type FilePanelMode = 'list' | 'round' | 'single'

const files = ref<SessionFile[]>([])
const selectedFileId = ref<string | null>(null)
const mode = ref<FilePanelMode>('list')
const loading = ref(false)

export function useFilePanel() {
  const selectedFile = computed(() =>
    files.value.find((f) => f.id === selectedFileId.value) ?? null,
  )

  async function loadFiles(sessionId: string) {
    loading.value = true
    try {
      const res = await getSessionFiles(sessionId)
      if (res.code === 0) {
        files.value = res.data.files
      }
    } finally {
      loading.value = false
    }
  }

  async function upload(sessionId: string, file: File) {
    const res = await uploadFile(sessionId, file)
    if (res.code === 0) {
      await loadFiles(sessionId)
    }
    return res
  }

  function selectFile(fileId: string | null) {
    selectedFileId.value = fileId
    mode.value = fileId ? 'single' : 'list'
  }

  function clearFiles() {
    files.value = []
    selectedFileId.value = null
    mode.value = 'list'
  }

  return {
    files,
    selectedFileId,
    selectedFile,
    mode,
    loading,
    loadFiles,
    upload,
    selectFile,
    clearFiles,
  }
}
