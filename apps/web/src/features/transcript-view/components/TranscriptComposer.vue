<template>
  <div ref="bar" class="chat-input-bar">
    <ChatInput
      v-model:prompt="prompt"
      v-model:preset="preset"
      :catalog="catalog"
      :running="running"
      :aborting="aborting"
      :error="sessionError"
      :cwd="composerCwd"
      :usage="contextUsage"
      :session-id="sessionId"
      @send="onSend"
      @abort="abortSession"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef, watch } from "vue"
import ChatInput from "@features/chat-input/index.vue"
import { useSession } from "@features/session-workbench/index.js"

defineProps<{
  sessionId: string
  running: boolean
}>()

const emit = defineEmits<{
  prepare: []
}>()

const {
  prompt,
  preset,
  catalog,
  aborting,
  sessionError,
  composerCwd,
  contextUsage,
  abortSession,
  submitText,
} = useSession()

const bar = useTemplateRef<HTMLElement>("bar")
let observer: ResizeObserver | undefined

function syncOverlay() {
  const el = bar.value
  const host = el?.parentElement
  if (!el || !host) return
  host.style.setProperty("--composer-overlay", `${el.offsetHeight}px`)
}

watch(
  bar,
  (el) => {
    observer?.disconnect()
    observer = undefined
    if (!el) return
    observer = new ResizeObserver(syncOverlay)
    observer.observe(el)
    syncOverlay()
  },
  { flush: "post" },
)

onBeforeUnmount(() => observer?.disconnect())

function onSend(text: string) {
  emit("prepare")
  return submitText(text)
}
</script>

<style scoped>
.chat-input-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 2;
  padding: 0 var(--spacing-md) 10px;
  pointer-events: none;
}
.chat-input-bar :deep(.prompt) {
  pointer-events: auto;
}
@media (max-width: 900px) {
  .chat-input-bar {
    padding-inline: var(--spacing-sm);
  }
}
</style>
