<template>
  <Popover :open="open" @open-change="onOpenChange">
    <PopoverContent
      v-if="open && reference && anchor"
      :anchor="anchor"
      :side="side"
      align="start"
      size="s"
      max-width="360px"
      :initial-focus="() => input"
      final-focus="none"
      class="reply-popover"
      @pointerdown.stop
      @mousedown.stop
      @keydown="onContainerKeydown"
    >
      <div class="reply-popover-body">
        <div class="reply-preview">
          <QuoteIcon class="reply-preview-icon" aria-hidden="true" />
          <span class="reply-preview-text">{{ quotePreview }}</span>
        </div>

        <textarea
          ref="input"
          v-model="draft"
          rows="2"
          class="reply-input"
          :aria-label="t('composer.replyCommentLabel')"
          :aria-description="t('composer.replyCommentHint')"
          :aria-invalid="tooLong || undefined"
          :placeholder="t('composer.replyCommentPlaceholder')"
          @keydown="onInputKeydown"
        />

        <p v-if="tooLong" role="status" class="reply-error">
          {{ t("composer.replyCommentTooLong", { max: REPLY_COMMENT_MAX }) }}
        </p>

        <div class="reply-actions">
          <Button
            type="button"
            variant="outline"
            size="s"
            tabindex="-1"
            @pointerdown.prevent
            @click="emit('cancel')"
          >
            {{ t("common.cancel") }}
          </Button>

          <Button
            type="button"
            variant="solid"
            color="accent"
            size="s"
            :disabled="tooLong"
            @pointerdown.prevent
            @click="submitSave"
          >
            {{ t("common.save") }}
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue"
import type { Side } from "@ui-sdk/core"
import type { ChangeDetails } from "@ui-sdk/core"
import type { PopoverOpenChangeReason } from "@ui-sdk/core/popover"
import { REPLY_COMMENT_MAX, type ReplyReference } from "@pig/protocol"
import { useI18n } from "@i18n/index.js"
import { QuoteIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { Popover, PopoverContent } from "@components/ui/popover/index.js"
import { resolveReplyCommentDismissal } from "@features/composer/lib/editor/reply-citation.js"

const props = withDefaults(
  defineProps<{
    open: boolean
    reference: ReplyReference | null
    anchor: HTMLElement | null
    side?: Side
  }>(),
  { side: "top" },
)
const emit = defineEmits<{
  save: [comment: string]
  autoSave: [comment: string]
  saveAndSend: [comment: string]
  cancel: []
  dismiss: []
}>()
const { t } = useI18n()
const input = useTemplateRef<HTMLTextAreaElement>("input")
const draft = ref("")
const dirty = ref(false)
const quotePreview = computed(() => (props.reference?.text ?? "").replace(/\s+/g, " ").trim())
const tooLong = computed(() => draft.value.length > REPLY_COMMENT_MAX)

watch(
  () => [props.open, props.reference] as const,
  ([isOpen, refItem]) => {
    if (!isOpen) {
      dirty.value = false
      return
    }

    draft.value = refItem?.comment ?? ""
    dirty.value = false
  },
  { immediate: true },
)

watch(draft, (value) => {
  if (props.open && value !== (props.reference?.comment ?? "")) dirty.value = true
})

watch(input, (el) => {
  if (!el || !props.open) return
  el.setSelectionRange(el.value.length, el.value.length)
  el.scrollTop = el.scrollHeight
})

function submitSave() {
  if (!tooLong.value) emit("save", draft.value)
}

function submitAndSend() {
  if (!tooLong.value) emit("saveAndSend", draft.value)
}

function onContainerKeydown(event: KeyboardEvent) {
  event.stopPropagation()

  if (event.isComposing || event.keyCode === 229) return

  if (event.key === "Escape") {
    event.preventDefault()
    emit("cancel")
  }
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return
  event.preventDefault()

  if (event.metaKey || event.ctrlKey) submitAndSend()
  else submitSave()
}

function onOpenChange(nextOpen: boolean, details: ChangeDetails<PopoverOpenChangeReason>) {
  if (nextOpen) return

  const dismissal = resolveReplyCommentDismissal({
    reason: details.reason,
    draft: dirty.value ? draft.value : null,
    savedComment: props.reference?.comment,
  })

  if (dismissal.kind === "keep-open") {
    details.cancel()
    return
  }

  if (dismissal.kind === "cancel") {
    emit("cancel")
    return
  }

  if (dismissal.kind === "commit") {
    emit("autoSave", dismissal.comment)
    return
  }

  emit("dismiss")
}
</script>

<style scoped>
:global(.reply-popover) {
  inline-size: min(340px, calc(100vw - 2 * var(--space-md)));
  min-inline-size: min(340px, calc(100vw - 2 * var(--space-md)));
  max-inline-size: min(340px, calc(100vw - 2 * var(--space-md)));
}

.reply-popover-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.reply-preview {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2xs);
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  background: var(--bg-muted);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.reply-preview-icon {
  flex: none;
  margin-top: 2px;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  color: var(--warning-text);
}

.reply-preview-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}

.reply-input {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 4lh;
  max-height: 160px;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  background: var(--control-bg);
  box-shadow: var(--control-shadow);
  color: var(--fg);
  font: inherit;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  resize: none;
  outline: none;
}

.reply-input:focus {
  box-shadow: var(--focus-ring);
}

.reply-input[aria-invalid="true"] {
  box-shadow: var(--focus-ring-danger);
}

.reply-input::placeholder {
  color: var(--fg-muted);
}

.reply-error {
  margin: 0;
  color: var(--danger-text);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
}
</style>
