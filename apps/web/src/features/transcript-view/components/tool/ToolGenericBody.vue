<template>
  <div class="tool-generic-body">
    <div v-if="input" class="tool-input">
      <CopyButton :text="input" />
      <pre class="tool-input-pre">{{ input }}</pre>
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
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import { toolInputPretty } from "@features/transcript-view/lib/transcript-format.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{
  call: ToolCallView
}>()
const { t } = useI18n()
const input = computed(() => toolInputPretty(props.call.input))
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

.tool-input-pre {
  margin: 0;
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
