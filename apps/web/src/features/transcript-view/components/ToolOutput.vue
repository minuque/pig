<template>
  <div v-if="code" class="tool-output is-code" :class="{ 'is-soft-wrap': softWrap }">
    <div class="code-scroll">
      <div class="code-lines" :style="{ '--line-number-width': `${lineNumberWidth}ch` }">
        <div v-for="(line, index) in shownLines" :key="index" class="code-line">
          <span v-if="showLineNumbers" class="line-number">{{ startLine + index }}</span>
          <code v-if="tokens[index]" v-token-line="tokens[index]" />
          <code v-else>{{ line }}</code>
        </div>
      </div>
    </div>

    <button v-if="hiddenLines" type="button" class="show-all" @click="expanded = true">
      显示全部（还有 {{ hiddenLines }} 行）
    </button>
  </div>

  <div v-else class="tool-output" :class="{ 'is-embedded': embedded, 'is-soft-wrap': softWrap }">
    <template v-if="showText">
      <pre class="tool-output-pre" :class="preClass">{{ shownText }}</pre>

      <button v-if="hiddenLines" type="button" class="show-all" @click="expanded = true">
        显示全部（还有 {{ hiddenLines }} 行）
      </button>
    </template>

    <div v-if="images.length" class="images">
      <TranscriptImage
        v-for="(image, index) in images"
        :key="index"
        :data="image.data"
        :mime-type="image.mimeType"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import { type CodeTokens, vTokenLine } from "@features/transcript-view/lib/markdown-render-props.js"
import type { TranscriptImage as ToolImage } from "@features/transcript-view/type.js"

const LINE_LIMIT = 500

/** 前 limit 行的结束位置和总行数；不超限时 end 为 -1。 */
function lineCut(text: string, limit: number) {
  let end = -1
  let count = 1

  for (let at = text.indexOf("\n"); at >= 0; at = text.indexOf("\n", at + 1)) {
    if (count === limit) end = at
    count += 1
  }

  return { end: count > limit ? end : -1, count }
}

const props = withDefaults(
  defineProps<{
    text?: string
    tone?: "code" | "plain"
    embedded?: boolean
    code?: boolean
    softWrap?: boolean
    lines?: readonly string[]
    tokens?: CodeTokens
    startLine?: number
    showLineNumbers?: boolean
    images?: ToolImage[]
  }>(),
  {
    text: "",
    tone: "code",
    embedded: false,
    code: false,
    softWrap: false,
    lines: () => [],
    tokens: () => [],
    startLine: 1,
    showLineNumbers: false,
    images: () => [],
  },
)
const expanded = shallowRef(false)
const showText = computed(() => props.text.length > 0 || props.images.length === 0)
const textCut = computed(() => (props.code ? null : lineCut(props.text, LINE_LIMIT)))
const shownText = computed(() => {
  const end = textCut.value?.end ?? -1
  return expanded.value || end < 0 ? props.text : props.text.slice(0, end)
})
const shownLines = computed(() => (expanded.value ? props.lines : props.lines.slice(0, LINE_LIMIT)))
const hiddenLines = computed(() => {
  if (expanded.value) return 0

  if (props.code) return Math.max(0, props.lines.length - LINE_LIMIT)
  const cut = textCut.value
  return cut && cut.end >= 0 ? cut.count - LINE_LIMIT : 0
})
const lineNumberWidth = computed(() =>
  Math.max(3, String(props.startLine + props.lines.length - 1).length),
)
const preClass = computed(() => ({
  "is-plain": props.tone === "plain",
  "is-embedded": props.embedded,
}))
</script>

<style scoped>
.tool-output {
  font-size: var(--text-code);
}

.tool-output.is-embedded {
  min-width: 0;
  padding: var(--spacing-xs);
  padding-inline-end: 0;
  overflow-x: auto;
  /* 卡片底比全局滚动条色深，滚动条会看不出，这里提到 ink 12% */
  --scrollbar-thumb: var(--hover-strong);
}

.tool-output-pre {
  position: relative;
  margin: var(--spacing-xxs) 0 0;
  padding: var(--spacing-sm);
  overflow: visible;
  border-radius: var(--radius-code);
  background: var(--code-surface);
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: inherit;
  line-height: var(--text-code-line);
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
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--text-code);
}

.images {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.code-scroll {
  overflow-x: auto;
  padding: var(--spacing-xs);
  padding-inline-end: 0;
  --scrollbar-thumb: var(--hover-strong);
}

/* 横向滚动条两端避开卡片圆角；只留横向滚动，不再需要 block 方向的让位 */
.code-scroll::-webkit-scrollbar-track,
.tool-output.is-embedded::-webkit-scrollbar-track {
  margin-inline: calc(var(--radius-code) - var(--border-width));
}

.code-lines {
  min-width: 0;
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
  tab-size: 2;
}

.code-line {
  display: flex;
  gap: var(--spacing-sm);
}

.line-number {
  flex: none;
  min-width: var(--line-number-width);
  color: var(--ink-muted);
  text-align: end;
  user-select: none;
}

code {
  color: var(--ink);
  font: inherit;
  white-space: pre;
}

.is-soft-wrap .code-lines {
  min-width: 0;
}

.show-all {
  position: sticky;
  inset-inline-start: 0;
  display: block;
  width: 100%;
  padding: var(--spacing-xs) 0;
  border: 0;
  border-top: var(--border-width) solid var(--border);
  background: transparent;
  color: var(--ink-muted);
  font: inherit;
  font-size: var(--text-caption);
  text-align: center;
  cursor: pointer;
}

.show-all:hover {
  color: var(--ink);
}

.is-soft-wrap code,
.is-soft-wrap .tool-output-pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
