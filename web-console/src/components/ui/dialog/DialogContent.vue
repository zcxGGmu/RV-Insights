<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { X } from 'lucide-vue-next'
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'
import DialogOverlay from './DialogOverlay.vue'

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()
const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      v-bind="forwarded"
      :class="cn(
        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-h-[95%] max-w-[98%] overflow-auto rounded-2xl border border-gray-200 bg-white p-0 z-[1000] shadow-xl dark:border-gray-700 dark:bg-gray-900',
        props.class,
      )"
    >
      <slot />
      <DialogClose
        class="absolute top-4 right-4 flex h-7 w-7 items-center justify-center cursor-pointer rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <X class="size-5 text-gray-400" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
