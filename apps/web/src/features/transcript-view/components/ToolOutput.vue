<template>
  <div v-if="code" class="tool-output is-code">
    <div class="code-scroll">
      <div class="code-lines" :style="{ '--line-number-width': `${lineNumberWidth}ch` }">
        <template v-for="line in visibleLines" :key="line.index">
          <button
            v-if="line.index === omitIndex && collapsed"
            type="button"
            class="omitted"
            @click="expanded = true"
          >
            … 其余 {{ hiddenCount }} 行
          </button>
          <div v-else class="code-line">
            <span class="line-number">{{ startLine + line.index }}</span>
            <code
              ><template v-if="tokens[line.index]"
                ><span
                  v-for="(token, index) in tokens[line.index]"
                  :key="index"
                  :style="{ color: token.color }"
                  >{{ token.content }}</span
                ></template
              ><template v-else>{{ line.text }}</template></code
            >
          </div>
        </template>
      </div>
    </div>
  </div>
  <div v-else class="tool-output" :class="{ 'is-embedded': embedded }">
    <template v-if="collapsed">
      <pre class="tool-output-pre" :class="preClass">{{ foldedHead }}</pre>
      <button type="button" class="omitted" @click="expanded = true">
        … 其余 {{ hiddenCount }} 行
      </button>
      <pre class="tool-output-pre" :class="preClass">{{ foldedTail }}</pre>
    </template>
    <template v-else>
      <pre v-if="!virtual" class="tool-output-pre" :class="preClass">{{ text }}</pre>
      <pre
        v-else
        class="tool-output-pre is-virtual"
        :class="preClass"
        :style="{ height: `${maxLines * lineHeight}px` }"
        @scroll="onScroll"
      >
        <span class="canvas" :style="{ height: `${totalHeight}px` }">
          <span class="window" :style="{ top: `${padTop}px` }">{{ visibleText }}</span>
        </span>
      </pre>
      <p v-if="virtual && showCount" class="meta">{{ lines.length }} 行</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import {
  DEFAULT_LINE_HEIGHT_PX,
  DEFAULT_MAX_EXPAND_LINES,
  DEFAULT_OVERSCAN_LINES,
  splitLines,
  TOOL_FOLD_HEAD,
  TOOL_FOLD_TAIL,
  toolFoldHidden,
  visibleLineRange,
} from "@features/transcript-view/lib/expandable-text.js"

const props = withDefaults(
  defineProps<{
    text?: string
    maxLines?: number
    lineHeight?: number
    tone?: "code" | "plain"
    showCount?: boolean
    embedded?: boolean
    code?: boolean
    lines?: readonly string[]
    tokens?: { content: string; color?: string }[][]
    startLine?: number
  }>(),
  {
    text: "",
    maxLines: DEFAULT_MAX_EXPAND_LINES,
    lineHeight: DEFAULT_LINE_HEIGHT_PX,
    tone: "code",
    showCount: true,
    embedded: false,
    code: false,
    lines: () => [],
    tokens: () => [],
    startLine: 1,
  },
)
const expanded = defineModel<boolean>("expanded", { default: false })

const omitIndex = TOOL_FOLD_HEAD - 1
const sourceLines = computed(() => (props.code ? [...props.lines] : splitLines(props.text)))
const hiddenCount = computed(() => toolFoldHidden(sourceLines.value.length))
const collapsed = computed(() => hiddenCount.value > 0 && !expanded.value)
const foldedHead = computed(() => sourceLines.value.slice(0, omitIndex).join("\n"))
const foldedTail = computed(() => sourceLines.value.slice(-TOOL_FOLD_TAIL).join("\n"))
const visibleLines = computed(() => {
  const lines = sourceLines.value.map((text, index) => ({ text, index }))
  return collapsed.value
    ? [...lines.slice(0, TOOL_FOLD_HEAD), ...lines.slice(-TOOL_FOLD_TAIL)]
    : lines
})
const lineNumberWidth = computed(() =>
  Math.max(3, String(props.startLine + sourceLines.value.length - 1).length),
)

const preClass = computed(() => ({
  "is-plain": props.tone === "plain",
  "is-embedded": props.embedded,
}))
const scrollTop = shallowRef(0)
const lines = computed(() => splitLines(props.text))
const virtual = computed(() => lines.value.length > props.maxLines)
const range = computed(() =>
  virtual.value
    ? visibleLineRange(
        scrollTop.value,
        props.lineHeight,
        props.maxLines,
        lines.value.length,
        DEFAULT_OVERSCAN_LINES,
      )
    : { start: 0, end: lines.value.length },
)
const visibleText = computed(() => lines.value.slice(range.value.start, range.value.end).join("\n"))
const padTop = computed(() => range.value.start * props.lineHeight)
const totalHeight = computed(() => lines.value.length * props.lineHeight)

function onScroll(event: Event) {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}
</script>

<style scoped>
.tool-output {
  font-size: var(--text-caption);
}
.tool-output-pre {
  position: relative;
  margin: var(--spacing-xxs) 0 0;
  padding: var(--spacing-sm);
  overflow: auto;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: inherit;
  line-height: 21px;
  white-space: pre;
  tab-size: 2;
}
.tool-output-pre.is-plain,
.tool-output-pre.is-embedded {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
.tool-output-pre.is-plain {
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: pre-wrap;
}
.tool-output-pre.is-embedded {
  color: inherit;
}
.tool-output.is-embedded .meta {
  color: inherit;
  opacity: 0.7;
}
.tool-output-pre.is-virtual {
  overflow: auto;
}
.canvas {
  position: relative;
  display: block;
}
.window {
  position: absolute;
  inset-inline: 0;
  display: block;
}
.meta {
  margin: var(--spacing-xxs) 0 0;
  color: var(--ink-faint);
  font-size: inherit;
}
.code-scroll {
  max-height: 480px;
  overflow: auto;
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg);
  scrollbar-width: thin;
}
.code-lines {
  min-width: max-content;
  font-family: var(--font-code);
  font-size: var(--text-caption);
  line-height: 22px;
  tab-size: 4;
}
.code-line {
  display: flex;
  gap: var(--spacing-sm);
}
.line-number {
  flex: none;
  min-width: var(--line-number-width);
  color: var(--ink-muted);
  text-align: right;
  user-select: none;
}
code {
  color: var(--ink);
  font: inherit;
  white-space: pre;
}
.omitted {
  display: block;
  margin-inline-start: 2ch;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font: inherit;
  cursor: pointer;
}
.tool-output:not(.is-code) .omitted {
  margin: var(--spacing-xxs) 0;
  margin-inline-start: 0;
}
.omitted:hover {
  color: var(--ink);
}
</style>
