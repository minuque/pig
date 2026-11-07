<template>
  <MarkdownMermaid v-if="fence.language === 'mermaid' && !live" :source="code" />

  <div v-else class="code-card" :data-line-numbers="showLineNumbers || undefined">
    <div class="code-header">
      <span v-if="fence.isFileReference" class="fence-file" :title="fence.filePath ?? undefined">
        <span class="fence-name">{{ fence.fileName }}</span>
        <span v-if="fence.directory" class="fence-dir">{{ fence.directory }}</span>
        <span v-if="fence.lineRange" class="fence-lines">{{ fence.lineRange }}</span>
      </span>

      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="line-toggle"
            :aria-label="lineLabel"
            :aria-pressed="showLineNumbers"
            @click.stop="showLineNumbers = !showLineNumbers"
          >
            <ListOrderedMinimalisticIcon class="size-icon" />
          </button>
        </TooltipTrigger>

        <TooltipContent>{{ lineLabel }}</TooltipContent>
      </Tooltip>

      <CopyButton :text="code" :label="t('transcript.copyCode')" />
    </div>

    <div class="code-body">
      <template v-for="(line, index) in lines" :key="index">
        <code v-if="tokens[index]" v-token-line="tokens[index]" class="code-line" />
        <code v-else class="code-line">{{ line }}</code>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, shallowRef, watch } from "vue"
import type { ElementNode } from "comark"
import { textContent } from "comark/utils"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { ListOrderedMinimalisticIcon } from "@components/icons/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import MarkdownMermaid from "@features/transcript-view/components/markdown/MarkdownMermaid.vue"
import { LIVE_BLOCK } from "@features/transcript-view/components/markdown/live-block.js"
import { parseCodeFenceInfo } from "@features/transcript-view/lib/code-fence.js"
import {
  highlightCodeTokens,
  type CodeTokens,
  vTokenLine,
} from "@features/transcript-view/lib/code-highlight.js"
import { useColorScheme } from "@features/theme/index.js"

const HIGHLIGHT_MAX_CHARS = 100_000
const props = defineProps<{ __node: ElementNode; language?: string }>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const liveBlock = inject(LIVE_BLOCK, undefined)
const live = computed(() => liveBlock?.value === props.__node)
const fence = computed(() => parseCodeFenceInfo(props.language ?? ""))
const code = computed(() => textContent(props.__node))
const lines = computed(() => code.value.split("\n"))
const tokens = shallowRef<CodeTokens>([])
const showLineNumbers = ref(false)
const lineLabel = computed(() =>
  showLineNumbers.value ? t("transcript.lineNumbersHide") : t("transcript.lineNumbersShow"),
)

// 写完才高亮：流式中的末块按纯文本长高，不和吐字抢主线程。
watch(
  [code, live, () => fence.value.language, () => codeBlockProps.value.theme],
  async ([text, isLive, language, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => (active = false))

    if (isLive || text.length > HIGHLIGHT_MAX_CHARS) return

    try {
      const next = await highlightCodeTokens(text, language, theme)

      if (active) tokens.value = next
    } catch {
      if (active) tokens.value = []
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.code-card {
  min-width: 0;
  overflow: hidden;
  border: var(--border-width) solid var(--border-soft);
  border-radius: var(--radius-code);
  background: var(--code-background);
  color: var(--code-foreground);
}

.code-header {
  position: relative;
  display: flex;
  align-items: center;
  min-height: calc(22px + var(--space-xxs) * 2);
  gap: var(--space-xs);
  padding: var(--space-xxs) var(--space-sm);
  padding-inline-end: calc(22px + var(--space-xxs) * 2);
}

.line-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-inline-start: auto;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--contrast-foreground-faint);
  cursor: pointer;
}

.line-toggle:hover,
.line-toggle[aria-pressed="true"] {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.fence-file {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  gap: 0.4em;
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: 1.4;
  color: var(--contrast-foreground);
}

.fence-name {
  flex: none;
  font-weight: var(--font-weight-medium);
}

.fence-dir {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fence-lines {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.code-body {
  padding: 0 var(--space-sm) var(--space-sm);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
  counter-reset: code-line;
}

.code-line {
  display: block;
  min-height: var(--text-code-line);
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.code-card[data-line-numbers] .code-line {
  white-space: pre;
  overflow-wrap: normal;
}

.code-card[data-line-numbers] .code-line::before {
  display: inline-block;
  width: 3ch;
  margin-inline-end: var(--space-sm);
  color: var(--contrast-foreground-faint);
  text-align: end;
  content: counter(code-line);
  counter-increment: code-line;
  user-select: none;
}
</style>
