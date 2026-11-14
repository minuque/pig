<template>
  <div ref="scroller" class="file-code">
    <p v-if="plain" class="file-code-notice">{{ t("files.plainNotice") }}</p>

    <div class="file-code-lines" :style="{ '--line-number-width': `${numberWidth}ch` }">
      <div
        v-for="(line, index) in lines"
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
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { useColorScheme } from "@features/theme/index.js"
import {
  highlightCodeTokens,
  vTokenLine,
  type CodeTokens,
} from "@features/transcript-view/lib/code-highlight.js"
import { fileLanguage } from "@features/transcript-view/lib/tool-summary.js"

/** 照 cc-wrapper 的 HIGHLIGHT_LIMITS：超过就按纯文本显示，不分词。 */
const MAX_CODE_UNITS = 100_000
const MAX_LINES = 2_000
const MAX_LINE_UNITS = 1_000
const props = defineProps<{
  path: string
  text: string
  /** 要滚到并标出的行范围；seq 变了就再跳一次。 */
  range?: { line: number; endLine: number; seq: number } | undefined
}>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const scroller = useTemplateRef("scroller")
const lines = computed(() => props.text.split(/\r\n|\n|\r/))
const numberWidth = computed(() => Math.max(3, String(lines.value.length).length))
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
  () => props.range?.seq,
  async () => {
    if (!props.range) return
    await nextTick()
    scroller.value
      ?.querySelector(`[data-line="${props.range.line}"]`)
      ?.scrollIntoView({ block: "center" })
  },
  { immediate: true, flush: "post" },
)
</script>

<style scoped>
.file-code {
  flex: 1;
  min-block-size: 0;
  overflow: auto;
  font-size: var(--text-code);
}

.file-code-notice {
  margin: 0;
  padding: var(--space-xs) var(--space-md);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}

.file-code-lines {
  inline-size: max-content;
  min-inline-size: 100%;
  padding-block: var(--space-xs);
  font-family: var(--font-mono);
  line-height: var(--text-code-line);
  tab-size: 2;
}

.file-code-line {
  display: flex;
  gap: var(--space-sm);
  padding-inline-end: var(--space-md);
  white-space: pre;
}

.file-code-line[data-hl] {
  background: var(--btn-hover);
}

.file-code-number {
  position: sticky;
  left: 0;
  flex: none;
  min-inline-size: var(--line-number-width);
  padding-inline: var(--space-md) 0;
  box-sizing: content-box;
  background: var(--surface);
  color: var(--contrast-foreground-faint);
  text-align: right;
  user-select: none;
}

.file-code-line[data-hl] .file-code-number {
  color: var(--contrast-foreground);
}
</style>
