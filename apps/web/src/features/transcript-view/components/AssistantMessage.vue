<template>
  <article
    :data-entry-id="item.entryId || undefined"
    :data-jump-highlighted="highlightMode || undefined"
  >
    <div
      v-if="item.text"
      :data-assistant-citation-source="canQuote ? item.entryId : undefined"
      :data-assistant-citation-session="canQuote ? sessionId : undefined"
    >
      <MarkdownContent :nodes="nodes" :streaming="streaming" />
    </div>

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
import { computed } from "vue"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import type { AssistantRow } from "@features/transcript-view/type.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
    sessionId?: string
    highlightMode?: "range" | "block" | null
  }>(),
  { streaming: false, sessionId: "", highlightMode: null },
)
const nodes = useMarkdownNodes({
  text: () => props.item.text,
  streaming: () => props.streaming,
  cacheKey: () => (props.sessionId ? `${props.sessionId}/${props.item.id}` : props.item.id),
})
const canQuote = computed(() =>
  Boolean(
    !props.streaming &&
    !props.item.streaming &&
    props.sessionId &&
    props.item.entryId &&
    props.item.text.trim(),
  ),
)
</script>

<style scoped>
article {
  border-radius: var(--radius-card);
  transition: background-color var(--duration-normal) var(--ease-out);
}

article[data-jump-highlighted="block"] {
  background: var(--bg-selected);
}

.md-pending {
  min-height: calc(var(--text-body) * 1.625);
}

.message-stamp {
  margin-top: var(--space-sm);
}

@media (prefers-reduced-motion: reduce) {
  article {
    transition: none;
  }
}
</style>
