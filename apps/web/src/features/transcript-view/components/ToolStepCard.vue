<template>
  <div class="tool-step-card" :class="cardClasses">
    <template v-if="commandContent">
      <ToolHeader
        v-model:expanded="commandExpanded"
        label="命令"
        :text="commandContent.command"
        :hidden-count="commandHidden"
      >
        <div class="command-heading">
          <span class="status-dot" :title="commandContent.statusLabel" />
          <span v-if="commandContent.cwd" class="cwd" :title="commandContent.cwd">
            {{ pathBasename(commandContent.cwd) }}
          </span>
          <code class="command" :title="commandContent.command">{{ commandContent.command }}</code>
        </div>
      </ToolHeader>
      <ToolOutput
        v-model:expanded="commandExpanded"
        :text="commandContent.outputText || commandContent.emptyOutput"
        :images="commandContent.outputImages"
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
    <template v-else-if="toolContent">
      <section v-if="toolContent.inputFull" class="layer">
        <ToolHeader
          v-model:expanded="inputExpanded"
          label="入参"
          :text="toolContent.inputFull"
          :hidden-count="inputHidden"
        />
        <ToolOutput
          v-model:expanded="inputExpanded"
          :text="toolContent.inputFull"
          :show-count="false"
          embedded
        />
      </section>
      <section class="layer">
        <ToolHeader
          v-model:expanded="outputExpanded"
          :label="toolContent.outputLabel"
          :text="toolContent.outputText"
          :hidden-count="outputHidden"
        />
        <ToolOutput
          v-model:expanded="outputExpanded"
          :text="
            toolContent.outputText ||
            (toolContent.outputImages.length ? '' : toolContent.emptyOutput)
          "
          :images="toolContent.outputImages"
          :show-count="false"
          embedded
        />
      </section>
    </template>
    <template v-else-if="editContent">
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
      <ThinkingBlocks :blocks="[thoughtContent.text]" :streaming="thoughtContent.streaming" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import { StreamDiff } from "stream-diffs/vue"
import { getLanguageIcon, languageIconsRevision } from "markstream-vue"
import ThinkingBlocks from "@features/transcript-view/components/ThinkingBlocks.vue"
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
  inputFull?: string
  outputLabel?: string
  editPreview?: EditDiffPreview
}>()
const commandContent = computed(() =>
  props.variant === "command"
    ? {
        command: props.command ?? "",
        cwd: props.cwd ?? "",
        outputText: props.outputText ?? "",
        outputImages: props.outputImages ?? [],
        emptyOutput: props.emptyOutput ?? "",
        status: props.status ?? "success",
        statusLabel: props.statusLabel ?? "",
      }
    : null,
)
const readContent = computed(() =>
  props.variant === "read" && props.path && props.preview
    ? { path: props.path, preview: props.preview }
    : null,
)
const toolContent = computed(() =>
  props.variant === "tool"
    ? {
        inputFull: props.inputFull ?? "",
        outputText: props.outputText ?? "",
        outputImages: props.outputImages ?? [],
        emptyOutput: props.emptyOutput ?? "",
        outputLabel: props.outputLabel ?? "输出",
      }
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
  "is-command": props.variant === "command",
  "is-err": commandContent.value?.status === "error",
  "is-run": commandContent.value?.status === "running",
}))
const { codeBlockProps } = useColorScheme()
const editDiffOptions = computed(() => ({ theme: codeBlockProps.value.theme }))
const commandExpanded = ref(false)
const inputExpanded = ref(false)
const outputExpanded = ref(false)
const readExpanded = ref(false)
const readTokens = shallowRef<{ content: string; color?: string }[][]>([])
const commandBody = computed(
  () => commandContent.value?.outputText || commandContent.value?.emptyOutput || "",
)
const commandHidden = computed(() => hiddenLineCount(splitLines(commandBody.value).length))
const inputHidden = computed(() =>
  hiddenLineCount(splitLines(toolContent.value?.inputFull ?? "").length),
)
const outputHidden = computed(() =>
  hiddenLineCount(
    splitLines(toolContent.value?.outputText || toolContent.value?.emptyOutput || "").length,
  ),
)
const readHidden = computed(() => hiddenLineCount(readContent.value?.preview.lines.length ?? 0))
const languageIconUrl = computed(() => {
  void languageIconsRevision.value
  const lang = readContent.value?.preview.language
  if (!lang) return ""
  return `data:image/svg+xml;utf8,${encodeURIComponent(getLanguageIcon(lang))}`
})
watch(commandBody, () => {
  commandExpanded.value = false
})
watch(
  () => toolContent.value?.inputFull,
  () => {
    inputExpanded.value = false
  },
)
watch(
  () => toolContent.value?.outputText,
  () => {
    outputExpanded.value = false
  },
)
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
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--code-body);
}
.tool-step-card.is-thought {
  padding: var(--spacing-sm);
  background: var(--canvas-soft);
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
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--success) 15%, transparent);
}
.is-err .status-dot {
  background: var(--danger);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 15%, transparent);
}
.is-run .status-dot {
  background: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 15%, transparent);
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
.layer + .layer {
  border-top: var(--border-width) solid var(--hairline);
}
.read-notice {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: var(--border-width) solid var(--hairline);
  color: var(--ink-muted);
  font-size: var(--text-caption);
  overflow-wrap: anywhere;
}
.edit-diff {
  max-width: 100%;
  overflow: auto;
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
