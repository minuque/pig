<template>
  <NodeViewWrapper as="span" class="chip-node" contenteditable="false" spellcheck="false">
    <Tooltip v-if="reference.kind === 'session'">
      <TooltipTrigger>
        <template #render="{ props: part }">
          <span
            v-bind="part"
            class="chip inline-chip"
            data-tone="success"
            :data-context-reference="source"
            data-context-kind="session"
          >
            <MessageSquareIcon class="inline-chip-icon" aria-hidden="true" />
            <span class="inline-chip-label">{{ reference.label }}</span>
          </span>
        </template>
      </TooltipTrigger>

      <TooltipContent side="top">{{ reference.label }}</TooltipContent>
    </Tooltip>

    <HoverCard v-else :disabled="isEditing">
      <HoverCardTrigger>
        <template #render="{ props: part }">
          <span
            v-bind="part"
            ref="chipEl"
            class="chip inline-chip is-reply"
            data-tone="warning"
            :data-context-reference="source"
            data-context-kind="reply"
            :data-cite-id="citeId || undefined"
          >
            <button
              type="button"
              class="reply-chip-main"
              :aria-label="t('composer.jumpToReply', { label: displayLabel })"
              @mousedown.prevent.stop
              @click.stop="onJump"
            >
              <QuoteIcon class="inline-chip-icon" aria-hidden="true" />
              <span class="inline-chip-label reply-chip-label">{{ displayLabel }}</span>
            </button>

            <Tooltip>
              <TooltipTrigger>
                <template #render="{ props: part }">
                  <button
                    v-bind="part"
                    type="button"
                    class="reply-chip-edit"
                    data-reply-edit-trigger
                    :aria-label="editLabel"
                    @pointerdown.prevent.stop
                    @mousedown.prevent.stop
                    @click.stop="onEdit"
                  >
                    <PenIcon class="reply-edit-icon" aria-hidden="true" />
                  </button>
                </template>
              </TooltipTrigger>

              <TooltipContent side="top">{{ editLabel }}</TooltipContent>
            </Tooltip>
          </span>
        </template>
      </HoverCardTrigger>

      <HoverCardContent side="top" align="start" size="s" max-width="420px">
        <div class="reply-hover-quote">{{ reference.text }}</div>
        <div v-if="reference.comment" class="reply-hover-comment">{{ reference.comment }}</div>
      </HoverCardContent>
    </HoverCard>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed, inject, useTemplateRef } from "vue"
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3"
import { formatContextReference } from "@pig/protocol"
import { useI18n } from "@i18n/index.js"
import { MessageSquareIcon, PenIcon, QuoteIcon } from "@components/icons/index.js"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pig/ui/hover-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { composerChipActionsKey } from "@features/composer/lib/editor/chip-actions.js"
import { contextReferenceAttrs } from "@features/composer/lib/editor/chip-tokens.js"
import { nextCiteId } from "@features/composer/lib/editor/reply-citation.js"

const props = defineProps(nodeViewProps)
const { t } = useI18n()
const actions = inject(composerChipActionsKey, undefined)
const chipEl = useTemplateRef("chipEl")
const reference = computed(() => contextReferenceAttrs(props.node.attrs as Record<string, unknown>))
const source = computed(() => formatContextReference(reference.value))
const citeId = computed(() => String(props.node.attrs["citeId"] ?? ""))
const isEditing = computed(
  () => Boolean(citeId.value) && actions?.editingCiteId.value === citeId.value,
)
const displayLabel = computed(() =>
  reference.value.kind === "reply"
    ? reference.value.comment || reference.value.label
    : reference.value.label,
)
const editLabel = computed(() =>
  reference.value.kind === "reply" && reference.value.comment
    ? t("composer.editReplyComment")
    : t("composer.addReplyComment"),
)

function onJump() {
  if (reference.value.kind !== "reply") return
  actions?.jumpReply({
    sessionId: reference.value.sessionId,
    entryId: reference.value.entryId,
    text: reference.value.text,
  })
}

function onEdit() {
  if (reference.value.kind !== "reply" || !chipEl.value || !actions) return
  let id = citeId.value

  if (!id) {
    id = nextCiteId()
    props.updateAttributes({ citeId: id })
  }

  actions.editReply({ citeId: id, reference: reference.value, anchor: chipEl.value })
}
</script>

<style scoped>
.is-reply {
  padding-inline-end: 2px;
}

.reply-chip-main {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  min-inline-size: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.reply-chip-main:hover .reply-chip-label {
  text-decoration: underline;
  text-decoration-style: dotted;
}

.reply-chip-label {
  max-inline-size: 16em;
}

.reply-chip-edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  inline-size: 1.15em;
  block-size: 1.15em;
  border-radius: calc(var(--radius-control) / 2);
  color: inherit;
  cursor: pointer;
}

.reply-chip-edit:hover {
  background: var(--bg-emphasis);
}

.reply-edit-icon {
  inline-size: calc(var(--icon-sm) - 2px);
  block-size: calc(var(--icon-sm) - 2px);
}

.reply-hover-quote {
  max-block-size: 220px;
  overflow-y: auto;
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reply-hover-comment {
  margin-top: var(--space-xs);
  padding-top: var(--space-xs);
  border-top: var(--border-width) solid var(--border-subtle);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
