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
          data-context-kind="reply"
          :data-session-id="reference.sessionId"
          :data-entry-id="reference.entryId"
          :aria-label="t('transcript.goToQuotedReply', { label: reference.label })"
          @click="onClick"
        >
          <span class="reply-card-excerpt">{{ excerpt }}</span>
          <ArrowUpRightIcon class="reply-card-jump" aria-hidden="true" />
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
import { ArrowUpRightIcon } from "@components/icons/index.js"
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
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  width: 100%;
  min-width: 0;
  padding: var(--space-2xs) var(--space-xs) var(--space-2xs) var(--space-sm);
  border: 0;
  border-radius: calc(var(--radius-card) - var(--space-2xs));
  background: transparent;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.reply-card::before {
  content: "";
  position: absolute;
  inset-inline-start: 0;
  inset-block: var(--space-2xs);
  inline-size: var(--quote-border-width);
  border-radius: var(--radius-pill);
  background: var(--border-strong);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.reply-card:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.reply-card:hover::before,
.reply-card:focus-visible::before {
  background: var(--accent-solid);
}

.reply-card:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.reply-card-jump {
  flex: none;
  margin-top: 2px;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  color: var(--fg-muted);
  opacity: 0;
  transform: translate(-1px, 1px);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.reply-card:hover .reply-card-jump,
.reply-card:focus-visible .reply-card-jump {
  opacity: 1;
  color: var(--fg);
  transform: translate(0, 0);
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
  .reply-card,
  .reply-card::before,
  .reply-card-jump {
    transition: none;
  }
}
</style>
