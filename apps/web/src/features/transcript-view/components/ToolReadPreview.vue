<template>
  <div class="read-card">
    <ToolWellHeader :label="path" :text="preview.code" shaded>
      <template #meta>
        <span>{{ lineSummary }}</span>
        <span class="language">{{ preview.languageLabel }}</span>
      </template>
    </ToolWellHeader>
    <div class="code-scroll" tabindex="0" :aria-label="`${path} 文件内容`">
      <div class="code-lines" :style="{ '--line-number-width': `${lineNumberWidth}ch` }">
        <template v-for="line in visibleLines" :key="line.index">
          <Button
            v-if="line.index === 4 && collapsed"
            type="button"
            variant="outline"
            class="omitted"
            static
            @click="expanded = true"
            >… 其余 {{ hiddenCount }} 行</Button
          >
          <div v-else class="code-line">
            <span class="line-number" aria-hidden="true">{{ preview.startLine + line.index }}</span>
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
    <Button
      v-if="expanded && hiddenCount > 0"
      type="button"
      variant="outline"
      class="collapse"
      static
      @click="expanded = false"
      >收起中间 {{ hiddenCount }} 行</Button
    >
    <p v-if="preview.notice" class="read-notice">{{ preview.notice }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue"
import { Button } from "@components/ui/button/index.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import ToolWellHeader from "@features/transcript-view/components/ToolWellHeader.vue"
import type { ReadToolPreview } from "@features/transcript-view/lib/tool-presentation.js"

const props = defineProps<{ path: string; preview: ReadToolPreview }>()
const { isDark } = useColorScheme()
const expanded = ref(false)
const tokens = shallowRef<{ content: string; color?: string }[][]>([])
const hiddenCount = computed(() => Math.max(0, props.preview.lines.length - 8))
const collapsed = computed(() => hiddenCount.value > 0 && !expanded.value)
const lineNumberWidth = computed(() =>
  Math.max(3, String(props.preview.startLine + props.preview.lines.length - 1).length),
)
const visibleLines = computed(() => {
  const lines = props.preview.lines.map((text, index) => ({ text, index }))
  return collapsed.value ? [...lines.slice(0, 5), ...lines.slice(-4)] : lines
})
const lineSummary = computed(() =>
  props.preview.totalLines === null
    ? `显示 ${props.preview.lines.length} 行`
    : `显示 ${props.preview.lines.length} / ${props.preview.totalLines} 行`,
)

watch(
  () => props.preview.code,
  () => {
    expanded.value = false
  },
)
watch(
  [() => props.preview, isDark],
  async ([preview, dark], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })
    if (preview.language === "text" || preview.code.length > 100_000) {
      tokens.value = []
      return
    }
    try {
      const theme = dark ? "dark-plus" : "light-plus"
      const { getSharedHighlighter } = await import("stream-diffs/pierre")
      const highlighter = await getSharedHighlighter({ themes: [theme], langs: [preview.language] })
      if (!active) return
      tokens.value = highlighter.codeToTokens(preview.code, {
        lang: preview.language,
        theme,
      }).tokens
    } catch {
      if (active) tokens.value = []
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.read-card {
  min-width: 0;
}
.language {
  font-family: var(--font-code);
}
.code-scroll {
  max-height: 480px;
  overflow: auto;
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg);
  scrollbar-width: thin;
}
.code-scroll:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: calc(-1 * var(--focus-ring-width));
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
.omitted,
.collapse {
  display: block;
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  box-shadow: none;
  font: inherit;
}
.omitted {
  margin-inline-start: 2ch;
}
.collapse {
  margin: 0 var(--spacing-lg) var(--spacing-xs);
  font-size: var(--text-caption);
}
.omitted:hover,
.collapse:hover {
  background: transparent;
  color: var(--ink);
}
.read-notice {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: var(--border-width) solid var(--hairline);
  color: var(--ink-muted);
  font-size: var(--text-caption);
  overflow-wrap: anywhere;
}
</style>
