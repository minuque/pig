<template>
  <div v-if="images.length" class="read-images">
    <TranscriptImage
      v-for="(image, index) in images"
      :key="index"
      :data="image.data"
      :mime-type="image.mimeType"
    />
  </div>

  <div v-else class="tool-step-card is-read">
    <ToolHeader
      v-model:soft-wrap="softWrap"
      v-model:show-line-numbers="showLineNumbers"
      line-numbers
      :label="t('transcript.output')"
      :text="preview.code"
    >
      <div class="read-heading">
        <TranscriptFileTag :path="path" :text="path" />
      </div>
    </ToolHeader>

    <ToolOutput
      code
      :soft-wrap="softWrap"
      :show-line-numbers="showLineNumbers"
      :lines="shownLines"
      :tokens="readTokens"
      :start-line="preview.startLine"
    />

    <div class="card-footer">
      <span class="footer-range">{{ rangeLabel }}</span>
      <span v-if="preview.notice" class="footer-muted">{{ preview.notice }}</span>

      <button
        v-if="preview.notice || clamped"
        type="button"
        class="footer-toggle"
        @click="expanded = !expanded"
      >
        {{ expanded ? t("common.collapse") : t("transcript.readFull") }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import ToolHeader from "@features/transcript-view/components/ToolHeader.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import TranscriptFileTag from "@features/transcript-view/components/TranscriptFileTag.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import { useColorScheme } from "@features/theme/index.js"
import {
  highlightCodeTokens,
  type CodeTokens,
} from "@features/transcript-view/lib/markdown-render-props.js"
import type { ReadToolPreview } from "@features/transcript-view/lib/tool-summary.js"
import type { TranscriptImage as ToolStepImage } from "@features/transcript-view/type.js"

const { t } = useI18n()
const props = defineProps<{
  path: string
  preview: ReadToolPreview
  outputImages?: ToolStepImage[]
}>()
const images = computed(() => props.outputImages ?? [])
const rangeLabel = computed(() => {
  const end = props.preview.startLine + props.preview.lines.length - 1
  return end > 1 ? `L${props.preview.startLine}–${end}` : ""
})
const softWrap = ref(true)
const showLineNumbers = ref(true)
const expanded = ref(false)
const READ_PREVIEW_LINES = 8
const clamped = computed(() => !expanded.value && props.preview.lines.length > READ_PREVIEW_LINES)
const shownLines = computed(() =>
  expanded.value ? props.preview.lines : props.preview.lines.slice(0, READ_PREVIEW_LINES),
)
const readTokens = shallowRef<CodeTokens>([])
const { codeBlockProps } = useColorScheme()

watch(
  [() => props.preview.code, () => props.preview.language, () => codeBlockProps.value.theme],
  async ([code, language, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })

    if (!code || !language || language === "text" || code.length > 100_000) {
      readTokens.value = []
      return
    }

    try {
      const next = await highlightCodeTokens(code, language, theme)

      if (!active) return
      readTokens.value = next
    } catch {
      if (active) readTokens.value = []
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.tool-step-card {
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  border-radius: var(--radius-code);
  background: var(--code-surface);
  box-shadow: var(--shadow-card);
}

.is-read :deep(.tool-header) {
  border-bottom-color: var(--border-subtle);
}

.read-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--size-icon-button);
  padding: 0 var(--spacing-sm);
  border-top: var(--border-width) solid var(--border-subtle);
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  font-variant-numeric: tabular-nums;
}

.footer-range {
  color: var(--ink-secondary);
}

.footer-muted {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footer-toggle {
  margin-inline-start: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font: inherit;
  cursor: pointer;
}

.footer-toggle:hover {
  color: var(--ink);
}

.read-images {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xs);
  max-width: 100%;
}

.read-images :deep(.thumb) {
  max-width: 100%;
}
</style>
