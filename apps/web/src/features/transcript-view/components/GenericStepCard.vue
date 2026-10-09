<template>
  <div class="tool-step-card is-tool">
    <ToolHeader v-model:soft-wrap="softWrap" :label="t('transcript.output')" :text="shownOutput">
      <div class="tool-heading">
        <span class="status-dot" :class="dotClass" :title="statusLabel" />
        <code class="tool-name">{{ toolName }}</code>
      </div>
    </ToolHeader>

    <div v-if="inputFull" class="tool-input-zone">
      <span class="prompt" aria-hidden="true">›</span>
      <code class="tool-input-summary" :title="inputFull">{{ inputSummary }}</code>
    </div>

    <div class="tool-output" :class="{ 'is-clamped': clamped, 'is-tail': status === 'running' }">
      <ToolOutput :soft-wrap="softWrap" :text="shownOutput" :images="outputImages" embedded />
    </div>

    <div class="card-footer">
      <span class="exit-badge" :class="status === 'error' ? 'is-err' : 'is-ok'">
        {{ status === "error" ? t("transcript.statusError") : t("transcript.statusDone") }}
      </span>

      <span v-if="lineCount">{{ t("transcript.outputLines", { count: lineCount }) }}</span>

      <button
        v-if="lineCount > PREVIEW_LINES"
        type="button"
        class="footer-toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? t("common.collapse") : t("transcript.showAllLines", { count: lineCount }) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import ToolHeader from "@features/transcript-view/components/ToolHeader.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import { toolInputHint } from "@features/transcript-view/lib/transcript-format.js"
import type { ToolCallView, TranscriptImage } from "@features/transcript-view/type.js"

const PREVIEW_LINES = 8
const { t } = useI18n()
const props = defineProps<{
  item: ToolCallView
  inputFull: string
  outputText: string
  outputImages: TranscriptImage[]
  emptyOutput: string
}>()
const shownOutput = computed(
  () => props.outputText || (props.outputImages.length ? "" : props.emptyOutput),
)
const lineCount = computed(() => (shownOutput.value ? shownOutput.value.split("\n").length : 0))
const status = computed(() =>
  props.item.isError ? "error" : props.item.running ? "running" : "success",
)
const toolName = computed(() => props.item.toolName)
const dotClass = computed(() =>
  status.value === "error" ? "is-error" : status.value === "running" ? "is-running" : "",
)
const statusLabel = computed(() =>
  status.value === "error"
    ? t("transcript.statusError")
    : status.value === "running"
      ? t("transcript.statusRunning")
      : t("transcript.statusDone"),
)
const inputSummary = computed(() => {
  try {
    return toolInputHint(JSON.parse(props.inputFull))
  } catch {
    return props.inputFull
  }
})
const expanded = ref(false)
const clamped = computed(() => !expanded.value && lineCount.value > PREVIEW_LINES)
const softWrap = ref(false)
</script>

<style scoped>
.tool-step-card {
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  border-radius: var(--radius-code);
  border: var(--border-width) solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.is-tool :deep(.tool-header) {
  border-bottom: 0;
  background: var(--surface);
}

.is-tool :deep(.tool-header .actions) {
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.is-tool:is(:hover, :focus-within) :deep(.tool-header .actions) {
  opacity: 1;
}

@media (hover: none) {
  .is-tool :deep(.tool-header .actions) {
    opacity: 1;
  }
}

.tool-heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.status-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin: 2px;
  border-radius: var(--radius-full);
  background: var(--success);
  box-shadow: 0 0 0 2px var(--success-halo);
}

.status-dot.is-error {
  background: var(--danger);
  box-shadow: 0 0 0 2px var(--danger-halo);
}

.status-dot.is-running {
  background: var(--primary);
  box-shadow: 0 0 0 2px var(--info-halo);
  animation: status-pulse 1.2s ease-in-out infinite;
}

.tool-name {
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}

.tool-input-zone {
  display: flex;
  gap: var(--spacing-xs);
  align-items: baseline;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-top: var(--border-width) solid var(--border-subtle);
  background: var(--code-surface);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
}

.prompt {
  flex: none;
  color: var(--ink-faint);
  user-select: none;
}

.tool-input-summary {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-output {
  border-top: var(--border-width) solid var(--border-subtle);
}

.tool-output.is-clamped {
  max-height: calc(var(--text-code-line) * 8 + var(--spacing-xs) * 2);
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black calc(100% - 2.5rem), transparent);
}

.tool-output.is-clamped.is-tail {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  mask-image: linear-gradient(to top, black calc(100% - 2.5rem), transparent);
}

.tool-output.is-tail :deep(.tool-output) {
  flex: none;
}

.tool-output :deep(.tool-output-pre.is-embedded) {
  color: var(--ink-secondary);
}

.card-footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--size-icon-button);
  padding: 0 var(--spacing-sm);
  border-top: var(--border-width) solid var(--border-subtle);
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  font-variant-numeric: tabular-nums;
}

.exit-badge {
  padding: 1px var(--spacing-xxs);
  border-radius: var(--radius-xs);
}

.exit-badge.is-ok {
  background: var(--success-bg);
  color: var(--success);
}

.exit-badge.is-err {
  background: var(--danger-bg);
  color: var(--danger);
}

.footer-toggle {
  margin-inline-start: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font: inherit;
  cursor: pointer;
}

.footer-toggle:hover {
  color: var(--ink);
}

@keyframes status-pulse {
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-dot {
    animation: none;
  }

  .is-tool :deep(.tool-header .actions) {
    transition: none;
  }
}
</style>
