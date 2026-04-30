<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { monaco } from '@/utils/monaco'

const props = withDefaults(defineProps<{
  original: string
  modified: string
  filename: string
  language?: string
}>(), {
  language: 'c'
})

const editorContainer = ref<HTMLElement | null>(null)
const isInline = ref(false)

let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null

function languageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp',
    s: 'asm', S: 'asm',
    py: 'python', rs: 'rust', go: 'go',
    sh: 'shell', bash: 'shell',
    mk: 'makefile', Makefile: 'makefile',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', txt: 'plaintext',
  }
  return map[ext] ?? props.language
}

function createModels() {
  const lang = languageFromFilename(props.filename)
  return {
    original: monaco.editor.createModel(props.original, lang),
    modified: monaco.editor.createModel(props.modified, lang),
  }
}

function initEditor() {
  if (!editorContainer.value) return

  diffEditor = monaco.editor.createDiffEditor(editorContainer.value, {
    readOnly: true,
    renderSideBySide: !isInline.value,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineHeight: 20,
  })

  const models = createModels()
  diffEditor.setModel(models)
}

function toggleInline() {
  isInline.value = !isInline.value
  diffEditor?.updateOptions({ renderSideBySide: !isInline.value })
}

onMounted(initEditor)

onBeforeUnmount(() => {
  const model = diffEditor?.getModel()
  model?.original?.dispose()
  model?.modified?.dispose()
  diffEditor?.dispose()
  diffEditor = null
})

watch([() => props.original, () => props.modified], () => {
  if (!diffEditor) return
  const oldModel = diffEditor.getModel()
  oldModel?.original?.dispose()
  oldModel?.modified?.dispose()
  const models = createModels()
  diffEditor.setModel(models)
})
</script>

<template>
  <div class="border border-gray-200 rounded-lg overflow-hidden">
    <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
      <span class="text-xs font-mono text-gray-600 truncate">{{ filename }}</span>
      <button
        class="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
        @click="toggleInline"
      >
        {{ isInline ? 'Side-by-side' : 'Inline' }}
      </button>
    </div>
    <div ref="editorContainer" class="h-[400px]" />
  </div>
</template>
