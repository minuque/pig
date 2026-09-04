<template>
  <div class="thinking-card">
    <div
      ref="viewport"
      class="thinking-body"
      :class="{ virtual }"
      :style="virtual ? { height: `${viewportPx}px` } : undefined"
      @scroll="onScroll"
    >
      <span v-if="virtual" class="canvas" :style="{ height: `${totalHeight}px` }">
        <span class="window" :style="{ top: `${padTop}px` }">{{ visibleText }}</span>
      </span>
      <MarkdownRender v-else-if="text" v-bind="thinkProps" :content="text" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownRender from "markstream-vue"
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-reveal.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"
import {
  DEFAULT_LINE_HEIGHT_PX,
  DEFAULT_OVERSCAN_LINES,
  shouldVirtualizeMarkdown,
  splitLines,
  visibleLineRange,
} from "@features/transcript-view/lib/expandable-text.js"

const MAX_LINES = 12

const props = withDefaults(
  defineProps<{
    blocks: readonly string[]
    streaming?: boolean
  }>(),
  { streaming: false },
)

const { isDark, codeBlockProps } = useColorScheme()
const text = useTranscriptReveal(
  () => props.blocks.join("\n"),
  () => props.streaming,
)
const lines = computed(() => splitLines(text.value))
const virtual = computed(() => !props.streaming && shouldVirtualizeMarkdown(text.value))
const scrollTop = shallowRef(0)
const viewport = useTemplateRef<HTMLElement>("viewport")
const viewportPx = MAX_LINES * DEFAULT_LINE_HEIGHT_PX
const range = computed(() =>
  virtual.value
    ? visibleLineRange(
        scrollTop.value,
        DEFAULT_LINE_HEIGHT_PX,
        MAX_LINES,
        lines.value.length,
        DEFAULT_OVERSCAN_LINES,
      )
    : { start: 0, end: 0 },
)
const visibleText = computed(() => lines.value.slice(range.value.start, range.value.end).join("\n"))
const padTop = computed(() => range.value.start * DEFAULT_LINE_HEIGHT_PX)
const totalHeight = computed(() => lines.value.length * DEFAULT_LINE_HEIGHT_PX)

const thinkProps = computed(
  () =>
    ({
      customId: "chat",
      mode: "minimal",
      renderCodeBlocksAsPre: true,
      final: !props.streaming,
      typewriter: false,
      smoothStreaming: false,
      isDark: isDark.value,
      codeBlockOptions: codeBlockTypography(),
      codeBlockProps: codeBlockProps.value,
    }) as const,
)

watch(
  () => [text.value, props.streaming] as const,
  async ([, streaming]) => {
    if (!streaming) return
    await nextTick()
    const root = viewport.value
    if (root) root.scrollTop = root.scrollHeight
  },
  { flush: "post" },
)

function onScroll(event: Event) {
  if (!virtual.value) return
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}
</script>

<style scoped>
.thinking-card {
  min-width: 0;
  padding: var(--spacing-sm);
}
.thinking-body {
  min-width: 0;
  max-height: calc(var(--text-body-sm) * var(--text-body-sm--line-height) * 12);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
}
.thinking-body.virtual {
  max-height: none;
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
  white-space: pre;
  tab-size: 2;
}
.canvas {
  position: relative;
  display: block;
}
.window {
  position: absolute;
  inset-inline: 0;
  display: block;
  white-space: pre;
}
.thinking-body :deep(p),
.thinking-body :deep(.paragraph-node) {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
  white-space: pre-wrap;
}
.thinking-body > :last-child :deep(p:last-child),
.thinking-body > :last-child :deep(.paragraph-node:last-child) {
  margin-bottom: 0;
}
</style>
