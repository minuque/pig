<template>
  <article
    :data-entry-id="item.entryId || undefined"
    :data-jump-highlighted="highlighted || undefined"
  >
    <div v-if="item.text" ref="content">
      <MarkdownContent :nodes="nodes" :streaming="streaming" />
    </div>

    <div v-else-if="streaming" class="md-pending" aria-hidden="true"></div>

    <MessageTimestamp
      v-if="item.showTimestamp"
      class="message-stamp"
      :timestamp="item.timestamp"
      :text="item.text"
      pinned
    >
      <template #actions>
        <Tooltip v-if="canQuote">
          <TooltipTrigger as-child>
            <IconButton
              type="button"
              size="s"
              variant="ghost"
              color="neutral"
              class="quote-button"
              data-quote-reply-button
              :aria-label="t('transcript.quoteReply')"
              @pointerdown.prevent
              @mousedown.prevent
              @click.stop="onQuoteClick"
            >
              <QuoteIcon class="size-icon" />
            </IconButton>
          </TooltipTrigger>

          <TooltipContent>{{ t("transcript.quoteReply") }}</TooltipContent>
        </Tooltip>
      </template>
    </MessageTimestamp>
  </article>
</template>

<script setup lang="ts">
import { computed, inject, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { QuoteIcon } from "@components/icons/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { quoteReplyKey } from "@features/transcript-view/index.js"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import type { AssistantRow } from "@features/transcript-view/type.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
    sessionId?: string
    highlighted?: boolean
  }>(),
  { streaming: false, sessionId: "", highlighted: false },
)
const { t } = useI18n()
const quoteReply = inject(quoteReplyKey, undefined)
const content = useTemplateRef("content")
const nodes = useMarkdownNodes({
  text: () => props.item.text,
  streaming: () => props.streaming,
  cacheKey: () => (props.sessionId ? `${props.sessionId}/${props.item.id}` : props.item.id),
})
const canQuote = computed(() =>
  Boolean(
    quoteReply &&
    !props.streaming &&
    !props.item.streaming &&
    props.sessionId &&
    props.item.entryId &&
    props.item.text.trim(),
  ),
)

function selectedTextInMessage(): string {
  const selection = document.getSelection()
  const box = content.value

  if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !box) return ""
  const range = selection.getRangeAt(0)

  if (!box.contains(range.startContainer) || !box.contains(range.endContainer)) return ""
  const text = selection.toString()
  return text.trim() ? text : ""
}

function onQuoteClick(event: MouseEvent) {
  const anchor = event.currentTarget

  if (!(anchor instanceof HTMLElement) || !quoteReply || !props.sessionId || !props.item.entryId) {
    return
  }

  const quote = selectedTextInMessage() || props.item.text

  if (!quote.trim()) return
  quoteReply({
    sessionId: props.sessionId,
    entryId: props.item.entryId,
    text: quote,
    anchor,
  })
}
</script>

<style scoped>
article {
  border-radius: var(--radius-card);
  transition: background-color var(--duration-normal) var(--ease-out);
}

article[data-jump-highlighted] {
  background: var(--warning-subtle);
}

.md-pending {
  min-height: calc(var(--text-body) * 1.625);
}

.message-stamp {
  margin-top: var(--space-sm);
}

.quote-button {
  color: var(--fg-secondary);
}

.quote-button:hover {
  color: var(--fg);
}

@media (prefers-reduced-motion: reduce) {
  article {
    transition: none;
  }
}
</style>
