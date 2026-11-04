<template>
  <div class="tool-generic-body">
    <pre v-if="input" class="tool-input">{{ input }}</pre>

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
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  background: var(--code-surface);
  color: var(--contrast-foreground-muted);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.tool-empty {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: inherit;
}
</style>
