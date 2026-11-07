<template>
  <CodeCard v-if="code" class="tool-output is-code" :class="{ 'is-soft-wrap': softWrap }">
    <CopyButton v-if="copyText" :text="copyText" />

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
      {{ t("transcript.showAllLines", { count: hiddenLines }) }}
    </button>
  </CodeCard>

  <div v-else class="tool-output" :class="{ 'is-soft-wrap': softWrap }">
    <template v-if="showText">
      <!-- 卡片只画边框，滚动交给里面的 pre：卡片自己滚动时 rt 的边框伪元素会跟着滚走 -->
      <CodeCard class="tool-output-card">
        <CopyButton v-if="copyText" :text="copyText" />
        <pre class="tool-output-pre">{{ shownText }}</pre>
      </CodeCard>

      <button v-if="hiddenLines" type="button" class="show-all" @click="expanded = true">
        {{ t("transcript.showAllLines", { count: hiddenLines }) }}
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
import { useI18n } from "@i18n/index.js"
import CodeCard from "@features/transcript-view/components/CodeCard.vue"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import { type CodeTokens, vTokenLine } from "@features/transcript-view/lib/code-highlight.js"
import type { TranscriptImage as ToolImage } from "@features/transcript-view/type.js"

const LINE_LIMIT = 500
const { t } = useI18n()

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
const copyText = computed(() => (props.code ? props.lines.join("\n") : props.text))
</script>

<style scoped>
.tool-output {
  position: relative;
  font-size: var(--text-code);
}

.tool-output-card {
  margin-top: var(--space-xxs);
}

.tool-output-pre {
  margin: 0;
  padding: var(--space-sm);
  padding-inline-end: calc(var(--space-sm) + 22px);
  color: var(--contrast-foreground-secondary);
  font-family: var(--font-mono);
  font-size: inherit;
  line-height: var(--text-code-line);
  white-space: pre;
  tab-size: 2;
  max-height: var(--transcript-tool-max);
  overflow: auto;
}

.images {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

.code-scroll {
  max-height: var(--transcript-tool-max);
  overflow: auto;
  padding: var(--space-xs);
  padding-inline-end: calc(var(--space-sm) + 22px);
  --scrollbar-thumb: var(--hover-strong);
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
  gap: var(--space-sm);
}

.line-number {
  flex: none;
  min-width: var(--line-number-width);
  color: var(--contrast-foreground-muted);
  text-align: end;
  user-select: none;
}

code {
  color: var(--contrast-foreground);
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
  padding: var(--space-xs) 0;
  border: 0;
  box-shadow: var(--divider-top);
  background: transparent;
  color: var(--contrast-foreground);
  font: inherit;
  font-size: var(--text-meta);
  text-align: center;
  cursor: pointer;
}

.show-all:hover {
  color: var(--contrast-foreground);
}

.is-soft-wrap code,
.is-soft-wrap .tool-output-pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
