<template>
  <div class="tool-generic-body">
    <div v-if="input" class="tool-input">
      <CopyButton :text="input" />

      <div class="tool-input-lines">
        <div v-for="(line, index) in lines" :key="index" class="tool-input-line">
          <code v-if="tokens[index]" v-token-line="tokens[index]" />
          <code v-else>{{ line }}</code>
        </div>
      </div>
    </div>

    <ToolOutput
      v-if="call.outputText || call.outputImages.length"
      :text="call.outputText"
      :images="call.outputImages"
      soft-wrap
    />

    <p v-else-if="call.running" class="tool-empty">{{ t("transcript.statusRunning") }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import {
  highlightCodeTokens,
  type CodeTokens,
  vTokenLine,
} from "@features/transcript-view/lib/markdown-render-props.js"
import { toolInputPretty } from "@features/transcript-view/lib/transcript-format.js"
import { useColorScheme } from "@features/theme/index.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{ call: ToolCallView }>()
const { t } = useI18n()
const { codeBlockProps } = useColorScheme()
const input = computed(() => toolInputPretty(props.call.input))
const lines = computed(() => input.value.split("\n"))
const tokens = shallowRef<CodeTokens>([])

watch(
  [input, () => codeBlockProps.value.theme],
  async ([text, theme], _, onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })

    if (!text || text.length > 100_000) {
      tokens.value = []
      return
    }

    try {
      const next = await highlightCodeTokens(text, "json", theme)

      if (active) tokens.value = next
    } catch {
      if (active) tokens.value = []
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.tool-generic-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.tool-input {
  position: relative;
  padding: var(--space-xs) var(--space-sm);
  padding-inline-end: calc(var(--space-sm) + 22px);
  border-radius: var(--radius-sm);
  background: var(--code-surface);
  color: var(--contrast-foreground-muted);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
}

.tool-input-lines {
  min-width: 0;
}

.tool-input-line {
  display: flex;
  min-width: 0;
}

.tool-input-line code {
  flex: 1;
  min-width: 0;
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.tool-empty {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: inherit;
}
</style>
