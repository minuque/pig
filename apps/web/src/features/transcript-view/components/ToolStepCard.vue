<template>
  <div class="tool-step-card" :class="cardClasses">
    <template v-if="commandContent">
      <ToolHeader label="命令" :text="commandContent.command">
        <div class="command-heading">
          <span class="status-dot" :title="commandContent.statusLabel" />
          <span v-if="commandContent.cwd" class="cwd" :title="commandContent.cwd">
            {{ pathBasename(commandContent.cwd) }}
          </span>
          <code class="command" :title="commandContent.command">{{ commandContent.command }}</code>
        </div>
      </ToolHeader>
      <div class="output">
        <ToolOutput
          :text="commandContent.outputText || commandContent.emptyOutput"
          :show-count="false"
          embedded
        />
        <div v-if="commandContent.outputImages.length" class="images">
          <TranscriptImage
            v-for="(image, index) in commandContent.outputImages"
            :key="index"
            :data="image.data"
            :mime-type="image.mimeType"
          />
        </div>
      </div>
    </template>
    <template v-else-if="readContent">
      <ToolHeader
        v-model:expanded="readExpanded"
        :label="readContent.path"
        :text="readContent.preview.code"
        shaded
        :foldable="readHidden > 0"
        :hidden-count="readHidden"
      >
        <template #meta>
          <span>{{ readSummary }}</span>
          <span class="language">{{ readContent.preview.languageLabel }}</span>
        </template>
      </ToolHeader>
      <ToolOutput
        v-model:expanded="readExpanded"
        code
        :path="readContent.path"
        :lines="readContent.preview.lines"
        :tokens="readTokens"
        :start-line="readContent.preview.startLine"
      />
      <p v-if="readContent.preview.notice" class="read-notice">{{ readContent.preview.notice }}</p>
    </template>
    <template v-else-if="toolContent">
      <section v-if="toolContent.inputFull" class="layer">
        <ToolHeader label="入参" :text="toolContent.inputFull" shaded />
        <div class="output">
          <ToolOutput :text="toolContent.inputFull" :show-count="false" embedded />
        </div>
      </section>
      <section class="layer">
        <ToolHeader :label="toolContent.outputLabel" :text="toolContent.outputText" shaded />
        <div class="output">
          <ToolOutput
            v-if="toolContent.outputText || !toolContent.outputImages.length"
            :text="toolContent.outputText || toolContent.emptyOutput"
            :show-count="false"
            embedded
          />
          <div v-if="toolContent.outputImages.length" class="images">
            <TranscriptImage
              v-for="(image, index) in toolContent.outputImages"
              :key="index"
              :data="image.data"
              :mime-type="image.mimeType"
            />
          </div>
        </div>
      </section>
    </template>
    <template v-else-if="thoughtContent">
      <div
        v-if="thoughtContent.previewing"
        ref="thoughtPreview"
        class="preview"
        role="region"
        aria-label="实时思考预览"
        tabindex="0"
        @wheel.stop
        @scroll.stop
      >
        {{ thoughtContent.text }}
      </div>
      <ThinkingBlocks v-else :blocks="[thoughtContent.text]" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import ThinkingBlocks from "@features/transcript-view/components/ThinkingBlocks.vue"
import ToolHeader from "@features/transcript-view/components/ToolHeader.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { toolFoldHidden } from "@features/transcript-view/lib/expandable-text.js"
import {
  pathBasename,
  type ReadToolPreview,
} from "@features/transcript-view/lib/tool-presentation.js"
import type { TranscriptImage as ToolStepImage } from "@features/transcript-view/lib/transcript-rows.js"

const props = defineProps<{
  variant: "thought" | "command" | "read" | "tool"
  text?: string
  previewing?: boolean
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
    ? { text: props.text ?? "", previewing: Boolean(props.previewing) }
    : null,
)
const cardClasses = computed(() => ({
  "is-thought": props.variant === "thought",
  "is-command": props.variant === "command",
  "is-err": commandContent.value?.status === "error",
  "is-run": commandContent.value?.status === "running",
}))
const thoughtPreview = ref<HTMLElement | null>(null)
watch(
  [() => thoughtContent.value?.text, thoughtPreview],
  () => {
    const element = thoughtPreview.value
    if (element) element.scrollTop = element.scrollHeight
  },
  { flush: "post" },
)

const { isDark } = useColorScheme()
const readExpanded = ref(false)
const readTokens = shallowRef<{ content: string; color?: string }[][]>([])
const readHidden = computed(() => toolFoldHidden(readContent.value?.preview.lines.length ?? 0))
const readSummary = computed(() => {
  const preview = readContent.value?.preview
  if (!preview) return ""
  return preview.totalLines === null
    ? `显示 ${preview.lines.length} 行`
    : `显示 ${preview.lines.length} / ${preview.totalLines} 行`
})
watch(
  () => readContent.value?.preview.code,
  () => {
    readExpanded.value = false
  },
)
watch(
  [readContent, isDark],
  async ([content, dark], _, onCleanup) => {
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
      const theme = dark ? "dark-plus" : "light-plus"
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
  background: var(--canvas-soft);
}
.tool-step-card.is-thought {
  padding: var(--spacing-sm);
}
.command-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  font-family: var(--font-code);
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
.language {
  font-family: var(--font-code);
}
.layer + .layer {
  border-top: var(--border-width) solid var(--hairline);
}
.output {
  min-width: 0;
  padding: var(--spacing-sm) 0 0 var(--spacing-sm);
}
.output :deep(.tool-output-pre) {
  color: var(--ink);
  font-family: var(--font-code);
  font-size: var(--text-caption);
}
.images {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}
.read-notice {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: var(--border-width) solid var(--hairline);
  color: var(--ink-muted);
  font-size: var(--text-caption);
  overflow-wrap: anywhere;
}
.preview {
  max-height: 5lh;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-anchor: none;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  scrollbar-width: thin;
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
