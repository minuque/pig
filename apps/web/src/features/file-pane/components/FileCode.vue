<template>
  <div class="file-code">
    <p v-if="plain" class="file-code-notice">{{ t("files.plainNotice") }}</p>

    <div v-bind="containerProps" class="file-code-scroller">
      <div v-bind="wrapperProps" class="file-code-lines" :style="[wrapperProps.style, linesStyle]">
        <div
          v-for="{ data: line, index } in list"
          :key="index"
          class="file-code-line"
          :data-line="index + 1"
          :data-hl="inRange(index + 1) || undefined"
        >
          <span class="file-code-number">{{ index + 1 }}</span>
          <code v-if="tokens[index]" v-token-line="tokens[index]" />
          <code v-else>{{ line }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useVirtualList } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { useColorScheme } from "@features/theme/index.js"
import {
  highlightCodeTokens,
  vTokenLine,
  type CodeTokens,
} from "@features/transcript-view/lib/code-highlight.js"
import { fileLanguage } from "@features/transcript-view/lib/tool-summary.js"

const MAX_CODE_UNITS = 100_000
const MAX_LINES = 2_000
const MAX_LINE_UNITS = 1_000
const LINE_HEIGHT = 24.5
const props = defineProps<{
  path: string
  text: string
  range?: { line: number; endLine: number; seq: number } | undefined
}>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const lines = computed(() => props.text.split(/\r\n|\n|\r/))
const numberWidth = computed(() => Math.max(3, String(lines.value.length).length))
const { list, containerProps, wrapperProps } = useVirtualList(lines, { itemHeight: LINE_HEIGHT })
const linesStyle = computed(() => {
  const longest = lines.value.reduce(
    (max, line) => Math.max(max, line.replace(/\t/g, "  ").length),
    0,
  )
  return {
    "--line-number-width": `${numberWidth.value}ch`,
    minInlineSize: `calc(${longest + numberWidth.value}ch + var(--space-md) * 2 + var(--space-sm))`,
  }
})
const language = computed(() => fileLanguage(props.path))
const plain = computed(
  () =>
    language.value !== "text" &&
    (props.text.length > MAX_CODE_UNITS ||
      lines.value.length > MAX_LINES ||
      lines.value.some((line) => line.length > MAX_LINE_UNITS)),
)
const tokens = shallowRef<CodeTokens>([])
const inRange = (line: number) =>
  Boolean(props.range && line >= props.range.line && line <= props.range.endLine)

watch(
  () => [props.text, language.value, plain.value, codeBlockProps.value.theme] as const,
  async ([text, lang, isPlain, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => (active = false))

    if (lang === "text" || isPlain) {
      tokens.value = []
      return
    }

    const next = await highlightCodeTokens(text, lang, theme).catch(() => [])

    if (active) tokens.value = next
  },
  { immediate: true },
)

watch(
  () => [props.range?.seq, containerProps.ref.value] as const,
  ([, el]) => {
    if (props.range && el)
      el.scrollTop = (props.range.line - 0.5) * LINE_HEIGHT - el.clientHeight / 2
  },
  { flush: "post" },
)
</script>

<style scoped>
.file-code {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
  font-size: var(--text-code);
}

.file-code-notice {
  margin: 0;
  padding: var(--space-xs) var(--space-md);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.file-code-scroller {
  flex: 1;
  min-block-size: 0;
  overflow: auto;
}

.file-code-lines {
  font-family: var(--font-mono);
  line-height: var(--text-code-line);
  tab-size: 2;
  text-autospace: no-autospace;
  text-spacing-trim: space-all;
}

.file-code-line {
  display: flex;
  gap: var(--space-sm);
  block-size: var(--text-code-line);
  padding-inline-end: var(--space-md);
  white-space: pre;
}

.file-code-line[data-hl] {
  background: var(--bg-hover);
}

.file-code-number {
  position: sticky;
  left: 0;
  flex: none;
  min-inline-size: var(--line-number-width);
  padding-inline: var(--space-md) 0;
  box-sizing: content-box;
  background: var(--bg-surface);
  color: var(--fg-secondary);
  text-align: right;
  user-select: none;
}

.file-code-line[data-hl] .file-code-number {
  color: var(--fg);
}
</style>
