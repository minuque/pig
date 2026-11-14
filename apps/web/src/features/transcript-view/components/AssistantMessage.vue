<template>
  <article>
    <MarkdownContent v-if="item.text" :nodes="nodes" :streaming="streaming" />
    <div v-else-if="streaming" class="md-pending" aria-hidden="true"></div>

    <MessageTimestamp
      v-if="item.showTimestamp"
      class="message-stamp"
      :timestamp="item.timestamp"
      :text="item.text"
      :pinned="pinned"
    />
  </article>
</template>

<script setup lang="ts">
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import type { AssistantRow } from "@features/transcript-view/type.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
    sessionId?: string
    /** 底栏常驻显示，不等悬停。 */
    pinned?: boolean
  }>(),
  { streaming: false, sessionId: "" },
)
const nodes = useMarkdownNodes({
  text: () => props.item.text,
  streaming: () => props.streaming,
  cacheKey: () => (props.sessionId ? `${props.sessionId}/${props.item.id}` : props.item.id),
})
</script>

<style scoped>
.md-pending {
  min-height: calc(var(--text-body) * 1.625);
}

.message-stamp {
  margin-top: var(--space-sm);
}
</style>
