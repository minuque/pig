<template>
  <article ref="root" @copy="onCopy">
    <MarkdownContent v-if="item.text" :nodes="nodes" :streaming="streaming" />
    <div v-else-if="streaming" class="md-pending" aria-hidden="true"></div>

    <MessageTimestamp
      v-if="item.showTimestamp"
      class="message-stamp"
      :timestamp="item.timestamp"
      :text="item.text"
      pinned
    />
  </article>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue"
import { CONTEXT_REFERENCE_MIME, formatContextReference, replyReference } from "@pig/protocol"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import type { AssistantRow } from "@features/transcript-view/type.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
    sessionId?: string
  }>(),
  { streaming: false, sessionId: "" },
)
const root = useTemplateRef("root")
const nodes = useMarkdownNodes({
  text: () => props.item.text,
  streaming: () => props.streaming,
  cacheKey: () => (props.sessionId ? `${props.sessionId}/${props.item.id}` : props.item.id),
})

function onCopy(event: ClipboardEvent) {
  const selection = document.getSelection()
  const range = selection && !selection.isCollapsed ? selection.getRangeAt(0) : undefined
  const box = root.value

  if (!event.clipboardData || !range || !box || !props.sessionId || props.item.streaming) return

  if (!box.contains(range.startContainer) || !box.contains(range.endContainer)) return
  const text = selection!.toString()

  if (!text.trim()) return
  const html = document.createElement("div")

  html.append(range.cloneContents())
  event.preventDefault()
  event.clipboardData.setData("text/plain", text)
  event.clipboardData.setData("text/html", html.innerHTML)
  event.clipboardData.setData(
    CONTEXT_REFERENCE_MIME,
    formatContextReference(replyReference(props.sessionId, props.item.entryId, text)),
  )
}
</script>

<style scoped>
.md-pending {
  min-height: calc(var(--text-body) * 1.625);
}

.message-stamp {
  margin-top: var(--space-sm);
}
</style>
