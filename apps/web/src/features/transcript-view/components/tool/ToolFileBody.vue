<template>
  <div class="tool-file-body">
    <div v-if="images.length" class="read-images">
      <TranscriptImage
        v-for="(image, index) in images"
        :key="index"
        :data="image.data"
        :mime-type="image.mimeType"
        :alt="target.text"
      />
    </div>

    <div v-else-if="variant === 'edit' && preview" class="edit-scroll">
      <CodeCard v-for="(hunk, index) in preview.hunks" :key="index" class="edit-hunk">
        <div class="edit-header">
          <OverflowTooltip class="edit-path" :text="preview.path || preview.fileName" />

          <CopyButton
            v-if="hunk.modified || hunk.original"
            :text="hunk.modified || hunk.original"
          />
        </div>

        <StreamDiff
          class="edit-diff"
          :original="hunk.original"
          :modified="hunk.modified"
          :language="preview.language"
          :file-name="preview.path || preview.fileName"
          diff-style="unified"
          :options="diffOptions"
        />
      </CodeCard>
    </div>

    <ToolOutput
      v-else-if="variant === 'read' && read"
      code
      :lines="read.lines"
      :tokens="tokens"
      :start-line="read.startLine"
      show-line-numbers
    />

    <ToolOutput v-else :text="call.outputText || fallback" soft-wrap />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { StreamDiff } from "stream-diffs/vue"
import { OverflowTooltip } from "@pig/ui/tooltip"
import CodeCard from "@features/transcript-view/components/CodeCard.vue"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import {
  highlightCodeTokens,
  isHighlightable,
  type CodeTokens,
} from "@features/transcript-view/lib/code-highlight.js"
import {
  editDiffPreview,
  readToolPreview,
  writeDiffPreview,
} from "@features/transcript-view/lib/tool-summary.js"
import { toolCallDetail } from "@features/transcript-view/lib/transcript-format.js"
import { toolCallTarget, toolCallVariant } from "@features/transcript-view/lib/tool-run.js"
import { useColorScheme } from "@features/theme/index.js"
import type { EditDiffPreview, ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
}>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const variant = computed(() => toolCallVariant(props.call))
const images = computed(() => props.call.outputImages)
const target = computed(() => toolCallTarget(props.call))
const read = computed(() => {
  if (variant.value !== "read" || props.call.isError || props.call.running) return null
  return readToolPreview(props.call.input, props.call.outputText)
})
const preview = computed<EditDiffPreview | null>(() => {
  if (variant.value !== "edit" || props.call.isError) return null
  return props.call.toolName.trim().toLowerCase() === "write"
    ? writeDiffPreview(props.call.input)
    : editDiffPreview(props.call.input)
})
const fallback = computed(
  () => toolCallDetail(props.call.toolName, props.call.input) || t("transcript.emptyOutput"),
)
const diffOptions = computed(() => ({
  theme: codeBlockProps.value.theme,
  maxHeight: "var(--transcript-tool-max)",
  unsafeCSS: `[data-diffs-header] { display: none; }`,
}))
const tokens = shallowRef<CodeTokens>([])

watch(
  [() => read.value?.code, () => read.value?.language, () => codeBlockProps.value.theme],
  async ([code, language, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })

    if (!isHighlightable(code, language)) {
      tokens.value = []
      return
    }

    try {
      const next = await highlightCodeTokens(code!, language!, theme)

      if (active) tokens.value = next
    } catch {
      if (active) tokens.value = []
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.tool-file-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.read-images {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.edit-scroll {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.edit-hunk {
  position: relative;
  min-width: 0;
}

.edit-diff {
  min-width: 0;
  font-size: var(--text-meta);
}

.edit-diff :deep(.stream-diffs-shell) {
  --scrollbar-thumb: var(--bg-emphasis);
}

/* 外部：内层的 overflow 是库写的行内样式，只能 !important 覆盖 */
.edit-diff :deep(.stream-diffs-finalized .stream-diffs-shell) {
  overflow: visible !important;
  max-height: none !important;
}

.edit-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-2xs) var(--space-2xs) var(--space-2xs) var(--space-sm);
}

.edit-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
  text-autospace: no-autospace;
  text-spacing-trim: space-all;
}

.edit-header :deep(.copy-button) {
  position: static;
}
</style>
