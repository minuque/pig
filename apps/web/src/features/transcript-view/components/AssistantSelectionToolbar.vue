<template>
  <Teleport to="body">
    <Button
      v-if="selection"
      ref="toolbar"
      type="button"
      size="s"
      variant="outline"
      color="neutral"
      class="selection-cite-button"
      data-quote-reply-button
      :disabled="tooLong"
      :aria-label="tooLong ? t('transcript.quoteTooLong') : t('transcript.quoteReply')"
      :style="{ left: `${selection.position.x}px`, top: `${selection.position.y}px` }"
      @pointerdown.prevent
      @mousedown.prevent
      @click.stop="onCite"
      @keydown="onButtonKeydown"
    >
      <QuoteIcon class="size-icon" aria-hidden="true" />
      <span>{{ tooLong ? t("transcript.shortenSelection") : t("transcript.quoteAction") }}</span>
    </Button>
  </Teleport>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from "vue"
import { REPLY_QUOTE_MAX } from "@pig/protocol"
import { useI18n } from "@i18n/index.js"
import { QuoteIcon } from "@components/icons/index.js"
import { Button } from "@pig/ui/button"
import { quoteReplyKey } from "@features/transcript-view/index.js"
import {
  captureAssistantSelection,
  createSelectionRangeAnchor,
  lastSelectionClientRect,
  observeSelectionActions,
  resolveSelectionActionPosition,
  type CapturedAssistantSelection,
  type SelectionActionsController,
  type SelectionPoint,
} from "@features/transcript-view/lib/selection-citation.js"

const props = defineProps<{
  viewport: HTMLElement | null
}>()
const { t } = useI18n()
const quoteReply = inject(quoteReplyKey, undefined)
const toolbar = useTemplateRef<ComponentPublicInstance | HTMLElement>("toolbar")
const selection = shallowRef<{
  captured: CapturedAssistantSelection
  position: SelectionPoint
} | null>(null)
const tooLong = computed(() => (selection.value?.captured.text.length ?? 0) > REPLY_QUOTE_MAX)
let actions: SelectionActionsController | null = null
let cleanupObservers: (() => void) | null = null

function toolbarElement(): HTMLButtonElement | null {
  const refValue = toolbar.value
  const el = refValue instanceof HTMLElement ? refValue : (refValue?.$el ?? null)
  return el instanceof HTMLButtonElement ? el : null
}

function clearSelection() {
  selection.value = null
}

function dismiss() {
  actions?.cancel()
  selection.value = null
}

watch(
  selection,
  (current) => {
    const button = toolbarElement()

    if (!button || !current) return
    const rect = button.getBoundingClientRect()

    button.style.left = `${Math.max(8, Math.min(current.position.x, window.innerWidth - rect.width - 8))}px`
    button.style.top = `${Math.max(8, Math.min(current.position.y, window.innerHeight - rect.height - 8))}px`
  },
  { flush: "post" },
)

watch(
  () => props.viewport,
  (viewport) => {
    cleanupObservers?.()
    cleanupObservers = null
    actions = null
    clearSelection()

    if (!viewport || !quoteReply) return

    const update = () => {
      const captured = captureAssistantSelection(viewport, window.getSelection())

      if (!captured) {
        clearSelection()
        return
      }

      const selectionRect = lastSelectionClientRect(captured.range)
      const bounds = viewport.getBoundingClientRect()
      const sourceBounds = captured.source.getBoundingClientRect()

      selection.value = {
        captured,
        position: resolveSelectionActionPosition({
          bounds,
          sourceBounds,
          selectionRect,
          viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
      }
    }

    actions = observeSelectionActions({
      element: viewport,
      getActionElement: toolbarElement,
      restoreAfterScroll: true,
      immediateMultiClick: true,
      onSelection: update,
      onDismiss: clearSelection,
    })
    const doc = viewport.ownerDocument
    const onSelectionChange = () => actions?.selectionChanged()
    const onFocusActions = (event: KeyboardEvent) => {
      const button = toolbarElement()

      if (
        event.key !== "Tab" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        event.defaultPrevented ||
        !button ||
        button.disabled ||
        button.contains(event.target as Node)
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      button.focus({ preventScroll: true })
    }

    doc.addEventListener("keydown", onFocusActions, true)
    doc.addEventListener("selectionchange", onSelectionChange)
    cleanupObservers = () => {
      doc.removeEventListener("keydown", onFocusActions, true)
      doc.removeEventListener("selectionchange", onSelectionChange)
      actions?.dispose()
    }
  },
  { immediate: true, flush: "post" },
)

onBeforeUnmount(() => {
  cleanupObservers?.()
  cleanupObservers = null
  actions = null
})

function onButtonKeydown(event: KeyboardEvent) {
  event.stopPropagation()

  if (event.key === "Escape" && !event.isComposing) {
    event.preventDefault()
    dismiss()
  }
}

function onCite() {
  const current = selection.value?.captured

  if (!current || tooLong.value || !quoteReply) return
  const clonedRange = current.range.cloneRange()
  const anchor = createSelectionRangeAnchor(current.source, clonedRange)

  quoteReply({
    sessionId: current.sessionId,
    entryId: current.entryId,
    text: current.text,
    anchor,
    range: clonedRange,
  })
  window.getSelection()?.removeAllRanges()
  dismiss()
}
</script>

<style scoped>
.selection-cite-button {
  position: fixed;
  z-index: var(--z-popover);
  max-inline-size: calc(100vw - 1rem);
  border-color: transparent;
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  color: var(--fg);
}

.selection-cite-button:hover:not([data-disabled]) {
  background-color: var(--bg-raised);
}
</style>
