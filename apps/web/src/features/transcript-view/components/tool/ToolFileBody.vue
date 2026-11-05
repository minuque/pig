<template>
  <div class="tool-file-body">
    <div v-if="images.length" class="read-images">
      <TranscriptImage
        v-for="(image, index) in images"
        :key="index"
        :data="image.data"
        :mime-type="image.mimeType"
      />
    </div>

    <div v-else-if="variant === 'edit' && preview" class="edit-scroll">
      <div v-for="(hunk, index) in preview.hunks" :key="index" class="edit-hunk">
        <CopyButton v-if="hunk.modified || hunk.original" :text="hunk.modified || hunk.original" />

        <StreamDiff
          class="edit-diff"
          :original="hunk.original"
          :modified="hunk.modified"
          :language="preview.language"
          :file-name="preview.path || preview.fileName"
          diff-style="unified"
          :options="diffOptions"
        />
      </div>
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
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import {
  highlightCodeTokens,
  type CodeTokens,
} from "@features/transcript-view/lib/markdown-render-props.js"
import {
  editDiffPreview,
  readToolPreview,
  writeDiffPreview,
} from "@features/transcript-view/lib/tool-summary.js"
import { toolCallDetail } from "@features/transcript-view/lib/transcript-format.js"
import { toolCallVariant } from "@features/transcript-view/lib/tool-run.js"
import { useColorScheme } from "@features/theme/index.js"
import type { EditDiffPreview, ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
}>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const variant = computed(() => toolCallVariant(props.call))
const images = computed(() => props.call.outputImages)
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
  /* 限高放在 diff 自身：滚动只发生在卡片里，头保持可见 */
  maxHeight: "var(--transcript-tool-max)",
  /* 卡片头只留文件路径：改动数已在工具行显示，图标与徽标不重复。右侧留出复制按钮 */
  unsafeCSS: `
    [data-diffs-header="default"] { position: sticky; top: 0; z-index: 2; min-height: 34px; padding-inline: 12px 40px; }
    [data-diffs-header] [data-title] { color: var(--contrast-foreground-muted); }
    [data-diffs-header] [data-change-icon],
    [data-diffs-header] [data-metadata] { display: none; }
  `,
}))
const tokens = shallowRef<CodeTokens>([])

watch(
  [() => read.value?.code, () => read.value?.language, () => codeBlockProps.value.theme],
  async ([code, language, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })

    if (!code || !language || language === "text" || code.length > 100_000) {
      tokens.value = []
      return
    }

    try {
      const next = await highlightCodeTokens(code, language, theme)

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
  border-radius: var(--radius-code);
  overflow: clip;
  font-size: var(--text-code-sm);
}

/* 全局 `*` 会给每个元素写默认拇指色；滚动的那层单独提亮，与其它工具卡同档 */
.edit-diff :deep(.stream-diffs-shell) {
  --scrollbar-thumb: var(--hover-strong);
}

/* 只留外层 shell 滚动；内层的 overflow 是库写的行内样式，只能 !important 覆盖 */
.edit-diff :deep(.stream-diffs-finalized .stream-diffs-shell) {
  overflow: visible !important;
  max-height: none !important;
}

/* 复制按钮落在卡片头里，与标题同高；代码区不再为它留白 */
.edit-hunk :deep(.copy-button) {
  top: 6px;
  inset-inline-end: var(--space-xs);
}
</style>
