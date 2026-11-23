<template>
  <span
    class="reply-block"
    :data-leading="leading || undefined"
    :data-trailing="trailing || undefined"
  >
    <HoverCard>
      <HoverCardTrigger as-child>
        <button
          type="button"
          class="reply-card"
          data-tone="warning"
          data-context-kind="reply"
          :data-session-id="reference.sessionId"
          :data-entry-id="reference.entryId"
          :aria-label="t('transcript.goToQuotedReply', { label: reference.label })"
          @click="onClick"
        >
          <QuoteIcon class="reply-card-icon" aria-hidden="true" />
          <span class="reply-card-excerpt">{{ excerpt }}</span>
        </button>
      </HoverCardTrigger>

      <HoverCardContent side="top" align="start" size="s" max-width="420px">
        <div class="reply-full-quote">{{ reference.text }}</div>
      </HoverCardContent>
    </HoverCard>

    <span v-if="reference.comment" class="reply-comment">{{ reference.comment }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, inject } from "vue"
import type { ReplyReference } from "@pig/protocol"
import { useI18n } from "@i18n/index.js"
import { QuoteIcon } from "@components/icons/index.js"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@components/ui/hover-card/index.js"
import { navigateReplyKey } from "@features/transcript-view/index.js"

const props = withDefaults(
  defineProps<{
    reference: ReplyReference
    leading?: boolean
    trailing?: boolean
  }>(),
  { leading: true, trailing: true },
)
const { t } = useI18n()
const navigateReply = inject(navigateReplyKey, undefined)
const excerpt = computed(() => props.reference.text.replace(/\s+/g, " ").trim())

function onClick() {
  navigateReply?.({
    sessionId: props.reference.sessionId,
    entryId: props.reference.entryId,
  })
}
</script>

<style scoped>
.reply-block {
  display: block;
}

.reply-block:not([data-leading]) {
  margin-top: var(--space-xs);
}

.reply-block:not([data-trailing]) {
  margin-bottom: var(--space-xs);
}

.reply-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  width: 100%;
  min-width: 0;
  padding: var(--space-2xs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: var(--bg-muted);
  box-shadow: inset var(--quote-border-width) 0 0 var(--tone-border);
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  text-align: start;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.reply-card:hover {
  background: var(--bg-emphasis);
  color: var(--fg);
}

.reply-card:focus-visible {
  outline: none;
  box-shadow:
    inset var(--quote-border-width) 0 0 var(--tone-border),
    var(--focus-ring);
}

.reply-card-icon {
  flex: none;
  margin-top: 3px;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  color: var(--tone-text);
}

.reply-card-excerpt {
  display: -webkit-box;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}

.reply-comment {
  display: block;
  margin-top: var(--space-xs);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reply-full-quote {
  max-block-size: 240px;
  overflow-y: auto;
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
  .reply-card {
    transition: none;
  }
}
</style>
