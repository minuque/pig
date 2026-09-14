<template>
  <div class="tool-step-card" :class="cardClasses">
    <template v-if="runContent">
      <ToolHeader
        v-model:expanded="runExpanded"
        :label="runContent.copyLabel"
        :text="runContent.copyText"
        :hidden-count="runHidden"
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
        v-model:expanded="runExpanded"
        :text="runContent.outputText || runContent.emptyOutput"
        :images="runContent.outputImages"
        :show-count="false"
        embedded
      />
    </template>

    <template v-else-if="readContent">
      <ToolHeader
        v-model:expanded="readExpanded"
        :label="readContent.path"
        :text="readContent.preview.code"
        :hidden-count="readHidden"
      >
        <div class="read-heading">
          <img
            v-if="languageIconUrl"
            class="icon-slot"
            :src="languageIconUrl"
            :title="readContent.preview.languageLabel"
            alt=""
          />

          <span class="read-path" :title="readContent.path">{{ readContent.path }}</span>
        </div>
      </ToolHeader>

      <ToolOutput
        v-model:expanded="readExpanded"
        code
        :lines="readContent.preview.lines"
        :tokens="readTokens"
        :start-line="readContent.preview.startLine"
      />

      <p v-if="readContent.preview.notice" class="read-notice">{{ readContent.preview.notice }}</p>
    </template>

    <template v-else-if="editContent">
      <ToolHeader :label="editHeading" :text="editCopyText">
        <div class="read-heading">
          <img
            v-if="editLanguageIconUrl"
            class="icon-slot"
            :src="editLanguageIconUrl"
            :title="editContent.language"
            alt=""
          />

          <span class="read-path" :title="editHeading">{{ editHeading }}</span>
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
        :original="hunk.original"
        :modified="hunk.modified"
        :language="editContent.language"
        :file-name="editContent.fileName"
        diff-style="unified"
        :options="editDiffOptions"
      />
    </template>

    <template v-else-if="thoughtContent">
      <ThinkingCard :blocks="[thoughtContent.text]" :streaming="thoughtContent.streaming" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import { StreamDiff } from "stream-diffs/vue"
import { getLanguageIcon, languageIconsRevision } from "markstream-vue"
import ThinkingCard from "@features/transcript-view/components/ThinkingCard.vue"
import ToolHeader from "@features/transcript-view/components/ToolHeader.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { splitLines, hiddenLineCount } from "@features/transcript-view/lib/expandable-text.js"
import {
  pathBasename,
  type ReadToolPreview,
} from "@features/transcript-view/lib/tool-presentation.js"
import type {
  EditDiffPreview,
  TranscriptImage as ToolStepImage,
} from "@features/transcript-view/type.js"

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
  preview?: ReadToolPreview
  heading?: string
  inputFull?: string
  editPreview?: EditDiffPreview
}>()

const runContent = computed(() => {
  if (props.variant === "command") {
    const command = props.command ?? ""
    const cwd = props.cwd ?? ""

    return {
      meta: cwd ? pathBasename(cwd) : "",
      metaTitle: cwd,
      heading: command,
      copyLabel: "命令",
      copyText: command,
      outputText: props.outputText ?? "",
      outputImages: props.outputImages ?? [],
      emptyOutput: props.emptyOutput ?? "",
      status: props.status ?? "success",
      statusLabel: props.statusLabel ?? "",
    }
  }

  if (props.variant !== "tool") return null
  const heading = props.heading ?? ""

  return {
    meta: "",
    metaTitle: "",
    heading,
    copyLabel: "入参",
    copyText: props.inputFull || heading,
    outputText: props.outputText ?? "",
    outputImages: props.outputImages ?? [],
    emptyOutput: props.emptyOutput ?? "",
    status: props.status ?? "success",
    statusLabel: props.statusLabel ?? "",
  }
})

const readContent = computed(() =>
  props.variant === "read" && props.path && props.preview
    ? { path: props.path, preview: props.preview }
    : null,
)

const thoughtContent = computed(() =>
  props.variant === "thought"
    ? { text: props.text ?? "", streaming: props.streaming ?? false }
    : null,
)

const editContent = computed(() =>
  props.variant === "edit" && props.editPreview?.hunks.length ? props.editPreview : null,
)

const cardClasses = computed(() => ({
  "is-thought": props.variant === "thought",
  "is-command": props.variant === "command" || props.variant === "tool",
  "is-err": runContent.value?.status === "error",
  "is-run": runContent.value?.status === "running",
}))

const { codeBlockProps } = useColorScheme()

const editDiffOptions = computed(() => ({
  theme: codeBlockProps.value.theme,
  disableFileHeader: true,
}))

const runExpanded = ref(false)

const readExpanded = ref(false)

const readTokens = shallowRef<{ content: string; color?: string }[][]>([])

const runBody = computed(() => runContent.value?.outputText || runContent.value?.emptyOutput || "")

const runHidden = computed(() => hiddenLineCount(splitLines(runBody.value).length))

const readHidden = computed(() => hiddenLineCount(readContent.value?.preview.lines.length ?? 0))

const languageIconUrl = computed(() => languageIconDataUrl(readContent.value?.preview.language))

const editLanguageIconUrl = computed(() => languageIconDataUrl(editContent.value?.language))

const editHeading = computed(() => editContent.value?.path || editContent.value?.fileName || "")

const editCopyText = computed(
  () => editContent.value?.hunks.map((hunk) => hunk.modified).join("\n") ?? "",
)

function languageIconDataUrl(lang: string | undefined) {
  void languageIconsRevision.value

  if (!lang || lang === "text") return ""

  return `data:image/svg+xml;utf8,${encodeURIComponent(getLanguageIcon(lang))}`
}

watch(runBody, () => {
  runExpanded.value = false
})

watch(
  () => readContent.value?.preview.code,
  () => {
    readExpanded.value = false
  },
)

watch(
  [readContent, codeBlockProps],
  async ([content, blockProps], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    const preview = content?.preview

    if (!preview || preview.language === "text" || preview.code.length > 100_000) {
      readTokens.value = []

      return
    }

    try {
      const theme = blockProps.theme
      const { getSharedHighlighter } = await import("stream-diffs/pierre")
      const highlighter = await getSharedHighlighter({ themes: [theme], langs: [preview.language] })

      if (!active) return
      readTokens.value = highlighter.codeToTokens(preview.code, {
        lang: preview.language,
        theme,
      }).tokens
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
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--code-body);
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

.read-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.icon-slot {
  display: block;
  width: var(--size-icon);
  height: var(--size-icon);
  flex: none;
}

.read-path {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.read-notice {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: var(--border-width) solid var(--hairline);
  color: var(--ink-muted);
  font-size: var(--text-caption);
  overflow-wrap: anywhere;
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
  overflow: auto;
}

.edit-diff :deep(.stream-diffs-vue-diff) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.edit-diff + .edit-diff {
  border-top: var(--border-width) solid var(--hairline);
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
