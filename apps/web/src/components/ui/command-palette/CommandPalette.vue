<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="command-palette" align="start" :show-close-button="false">
      <DialogTitle class="sr-only">{{ title }}</DialogTitle>

      <ListboxRoot ref="listbox" data-slot="command-palette" highlight-on-hover>
        <slot />
      </ListboxRoot>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from "vue"
import { ListboxRoot } from "reka-ui"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const listbox = useTemplateRef<{ highlightFirstItem: () => void }>("listbox")

// 打开时先高亮第一项，回车直接选中
watch(
  () => props.open,
  (open) => open && nextTick(() => listbox.value?.highlightFirstItem()),
)
</script>

<!-- 面板经 Portal 挂到 body，父级 scoped 打不中，只能不加 scoped；位置只能改 margin，rt 靠 margin:auto 对中 -->
<style>
.rt-DialogContent.command-palette {
  display: flex;
  flex-direction: column;
  width: min(672px, calc(100vw - var(--space-lg) * 2));
  max-width: none;
  max-height: min(70dvh, 640px);
  padding: 0;
  margin-block: 10dvh auto;
  overflow: hidden;
}
</style>

<style scoped>
[data-slot="command-palette"] {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}
</style>
