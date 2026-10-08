<template>
  <div v-if="readImages.length" class="read-images">
    <TranscriptImage
      v-for="(image, index) in readImages"
      :key="index"
      :data="image.data"
      :mime-type="image.mimeType"
    />
  </div>

  <div v-else class="tool-step-card" :class="cardClasses">
    <template v-if="runContent">
      <ToolHeader
        v-model:soft-wrap="softWrap"
        :label="t('transcript.output')"
        :text="runContent.shownOutput"
      >
        <div class="command-heading">
          <span class="status-dot" :title="runContent.statusLabel" />

          <span v-if="runContent.meta" class="cwd" :title="runContent.metaTitle">
            {{ runContent.meta }}
          </span>

          <code class="command" :title="runContent.heading">{{ runContent.heading }}</code>
        </div>
      </ToolHeader>

      <ToolOutput
        :soft-wrap="softWrap"
        :text="runContent.shownOutput"
        :images="runContent.outputImages"
        embedded
      />
    </template>

    <template v-else-if="readContent">
      <ToolHeader
        v-model:soft-wrap="softWrap"
        v-model:show-line-numbers="showLineNumbers"
        line-numbers
        :label="t('transcript.output')"
        :text="readContent.preview.code"
      >
        <div class="read-heading">
          <TranscriptFileTag :path="readContent.path" :text="readContent.path" />
        </div>
      </ToolHeader>

      <ToolOutput
        code
        :soft-wrap="softWrap"
        :show-line-numbers="showLineNumbers"
        :lines="readContent.preview.lines"
        :tokens="readTokens"
        :start-line="readContent.preview.startLine"
      />

      <p v-if="readContent.preview.notice" class="read-notice">
        {{ readContent.preview.notice }}
      </p>
    </template>

    <template v-else-if="toolContent">
      <ToolHeader
        v-if="toolContent.inputFull || toolContent.shownOutput"
        v-model:soft-wrap="softWrap"
        :label="t('transcript.output')"
        :text="toolContent.shownOutput"
      >
        <ToolInputJson v-if="toolContent.inputFull" :text="toolContent.inputFull" />
      </ToolHeader>

      <ToolOutput
        :soft-wrap="softWrap"
        :text="toolContent.shownOutput"
        :images="toolContent.outputImages"
        embedded
      />
    </template>

    <template v-else-if="editContent">
      <ToolHeader
        v-model:soft-wrap="softWrap"
        :label="t('transcript.output')"
        :text="editContent.outputText"
      >
        <div class="read-heading">
          <TranscriptFileTag :path="editHeading" :text="editHeading" />
        </div>

        <template #meta>
          <span v-if="editContent.removed || editContent.added" class="line-stats">
            <span v-if="editContent.removed" class="removed">-{{ editContent.removed }}</span>
            <span v-if="editContent.added" class="added">+{{ editContent.added }}</span>
          </span>
        </template>
      </ToolHeader>

      <StreamDiff
        v-for="(hunk, index) in editContent.hunks"
        :key="index"
        class="edit-diff"
        :class="{ 'is-soft-wrap': softWrap }"
        :original="hunk.original"
        :modified="hunk.modified"
        :language="editContent.language"
        :file-name="editContent.fileName"
        diff-style="unified"
        :options="editDiffOptions"
      />
    </template>

    <blockquote v-else-if="thoughtContent" class="thought">
      <MarkdownRender
        v-if="thoughtContent.text"
        v-bind="thoughtProps"
        :content="thoughtContent.text"
      />
    </blockquote>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { StreamDiff } from "stream-diffs/vue"
import MarkdownRender from "markstream-vue"
import ToolHeader from "@features/transcript-view/components/ToolHeader.vue"
import ToolInputJson from "@features/transcript-view/components/ToolInputJson.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import TranscriptFileTag from "@features/transcript-view/components/TranscriptFileTag.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import { useColorScheme } from "@features/theme/index.js"
import {
  highlightCodeTokens,
  plainMarkdownProps,
  type CodeTokens,
} from "@features/transcript-view/lib/markdown-render-props.js"
import { pathBasename, type ReadToolPreview } from "@features/transcript-view/lib/tool-summary.js"
import type {
  EditDiffPreview,
  TranscriptImage as ToolStepImage,
} from "@features/transcript-view/type.js"

const { t } = useI18n()
const props = defineProps<{
  variant: "thought" | "command" | "read" | "edit" | "tool"
  text?: string
  streaming?: boolean
  command?: string
  cwd?: string
  outputText?: string
  outputImages?: ToolStepImage[]
  emptyOutput?: string
  status?: "error" | "running" | "success"
  statusLabel?: string
  path?: string
  preview?: ReadToolPreview | undefined
  inputFull?: string
  editPreview?: EditDiffPreview
}>()
const runContent = computed(() => {
  if (props.variant !== "command") return null
  const command = props.command ?? ""
  const cwd = props.cwd ?? ""
  return {
    meta: cwd ? pathBasename(cwd) : "",
    metaTitle: cwd,
    heading: command,
    shownOutput: props.outputText || props.emptyOutput || "",
    outputImages: props.outputImages ?? [],
    status: props.status ?? "success",
    statusLabel: props.statusLabel ?? "",
  }
})
const readContent = computed(() =>
  props.variant === "read" && props.path && props.preview
    ? { path: props.path, preview: props.preview }
    : null,
)
const readImages = computed(() => (props.variant === "read" ? (props.outputImages ?? []) : []))
const toolContent = computed(() =>
  props.variant === "tool"
    ? {
        inputFull: props.inputFull ?? "",
        shownOutput:
          props.outputText || ((props.outputImages ?? []).length ? "" : (props.emptyOutput ?? "")),
        outputImages: props.outputImages ?? [],
      }
    : null,
)
const thoughtContent = computed(() =>
  props.variant === "thought"
    ? { text: props.text ?? "", streaming: props.streaming ?? false }
    : null,
)
const editContent = computed(() =>
  props.variant === "edit" && props.editPreview?.hunks.length
    ? { ...props.editPreview, outputText: props.outputText ?? "" }
    : null,
)
const cardClasses = computed(() => ({
  "is-thought": props.variant === "thought",
  "is-command": props.variant === "command",
  "is-tool": props.variant === "tool",
  "is-err": runContent.value?.status === "error",
  "is-run": runContent.value?.status === "running",
}))
const { codeBlockProps, isDark } = useColorScheme()
const thoughtProps = computed(() =>
  plainMarkdownProps({ streaming: Boolean(thoughtContent.value?.streaming), isDark: isDark.value }),
)
const editDiffOptions = computed(() => ({
  theme: codeBlockProps.value.theme,
  disableFileHeader: true,
}))
const readTokens = shallowRef<CodeTokens>([])
const editHeading = computed(() => editContent.value?.path || editContent.value?.fileName || "")
const softWrap = ref(false)
const showLineNumbers = ref(false)

watch(
  [
    () => readContent.value?.preview.code,
    () => readContent.value?.preview.language,
    () => codeBlockProps.value.theme,
  ],
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
}

.is-thought {
  /* 对齐摘要按钮的文字起点：图标列加一格间距 */
  padding-inline-start: calc(var(--size-icon) + var(--spacing-xs));
  border: 0;
  background: transparent;
  box-shadow: none;
}

.thought {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
}

.thought
  :deep(
    :is([data-custom-id="thought"], p, .paragraph-node, h1, h2, h3, h4, h5, h6, li, pre, code)
  ) {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-family: inherit;
  white-space: pre-wrap;
}

.thought :deep(.code-block-header),
.thought :deep(.code-header-actions) {
  display: none;
}

.thought :deep(.code-block-container) {
  margin: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.command-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  font-family: var(--font-mono);
}

.status-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin: 2px;
  border-radius: var(--radius-full);
  background: var(--success);
  box-shadow: 0 0 0 2px var(--success-halo);
}

.is-err .status-dot {
  background: var(--danger);
  box-shadow: 0 0 0 2px var(--danger-halo);
}

.is-run .status-dot {
  background: var(--primary);
  box-shadow: 0 0 0 2px var(--info-halo);
  animation: status-pulse 1.2s ease-in-out infinite;
}

.cwd {
  flex: 0 1 auto;
  max-width: 16ch;
  overflow: hidden;
  color: var(--ink-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-tool :deep(.tool-header-pin) {
  position: static;
  container-type: normal;
}

.is-tool :deep(.tool-header) {
  align-items: flex-start;
}

.read-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.read-notice {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: var(--border-width) solid var(--border);
  color: var(--ink-muted);
  font-size: var(--text-caption);
  overflow-wrap: anywhere;
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

.line-stats {
  display: inline-flex;
  gap: var(--spacing-xs);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.added {
  color: var(--success);
}

.removed {
  color: var(--danger);
}

.edit-diff {
  max-width: 100%;
  overflow: visible;
}

.edit-diff.is-soft-wrap :deep(pre),
.edit-diff.is-soft-wrap :deep(code) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.edit-diff::-webkit-scrollbar-track {
  margin-inline: calc(var(--radius-code) - var(--border-width));
  margin-block-end: calc(var(--radius-code) - var(--border-width));
}

.edit-diff :deep(.stream-diffs-vue-diff) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.edit-diff + .edit-diff {
  border-top: var(--border-width) solid var(--border);
}

@keyframes status-pulse {
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-dot {
    animation: none;
  }
}
</style>
