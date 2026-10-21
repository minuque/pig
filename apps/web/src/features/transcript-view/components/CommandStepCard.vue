<template>
  <div class="command-card" :class="`is-${status}`">
    <ToolHeader v-model:soft-wrap="softWrap" :label="t('transcript.output')" :text="output">
      <div class="heading">
        <span class="status-dot" :title="statusLabel" />
        <span class="tool-name">{{ toolName }}</span>
        <span v-if="cwd" class="cwd" :title="cwd">{{ pathBasename(cwd) }}</span>
      </div>
    </ToolHeader>

    <div class="command-line">
      <span class="prompt" aria-hidden="true">$</span>
      <code class="command">{{ command }}</code>
    </div>

    <div class="command-output" :class="{ 'is-clamped': clamped, 'is-tail': status === 'running' }">
      <ToolOutput
        :soft-wrap="softWrap"
        :text="output || emptyOutput"
        :images="outputImages"
        embedded
      />
    </div>

    <div class="command-footer">
      <span
        v-if="parsed.exitCode !== undefined"
        class="exit-badge"
        :class="parsed.exitCode === 0 ? 'is-ok' : 'is-err'"
      >
        exit {{ parsed.exitCode }}
      </span>

      <span v-else class="footer-status">{{ parsed.statusLine || statusLabel }}</span>
      <span v-if="lineCount">{{ t("transcript.outputLines", { count: lineCount }) }}</span>

      <button
        v-if="lineCount > PREVIEW_LINES"
        type="button"
        class="footer-toggle"
        :aria-expanded="open"
        @click="expanded = !open"
      >
        {{ open ? t("common.collapse") : t("transcript.showAllLines", { count: lineCount }) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import ToolHeader from "@features/transcript-view/components/ToolHeader.vue"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import { pathBasename } from "@features/transcript-view/lib/tool-summary.js"
import { splitCommandStatus } from "@features/transcript-view/lib/transcript-format.js"
import type { TranscriptImage } from "@features/transcript-view/type.js"

const PREVIEW_LINES = 8
const { t } = useI18n()
const props = defineProps<{
  toolName: string
  command: string
  cwd: string
  outputText: string
  outputImages: TranscriptImage[]
  emptyOutput: string
  status: "error" | "running" | "success"
  statusLabel: string
}>()
const parsed = computed(() => splitCommandStatus(props.outputText, props.status))
const output = computed(() => parsed.value.body.trimEnd())
const lineCount = computed(() => (output.value ? output.value.split("\n").length : 0))
const softWrap = ref(false)
/** 用户未切换时，失败命令默认展开输出。 */
const expanded = ref<boolean>()
const open = computed(() => expanded.value ?? props.status === "error")
const clamped = computed(() => !open.value && lineCount.value > PREVIEW_LINES)
</script>

<style scoped>
.command-card {
  min-width: 0;
  max-width: 100%;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-code);
  background: var(--card);
  box-shadow: var(--shadow-card);
}

.command-card.is-error {
  border-color: var(--destructive-border);
}

.command-card :deep(.tool-header) {
  border-bottom: 0;
  background: var(--card);
}

.command-card :deep(.tool-header .actions) {
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.command-card:is(:hover, :focus-within) :deep(.tool-header .actions) {
  opacity: 1;
}

@media (hover: none) {
  .command-card :deep(.tool-header .actions) {
    opacity: 1;
  }
}

.heading {
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

.is-error .status-dot {
  background: var(--destructive);
  box-shadow: 0 0 0 2px var(--destructive-halo);
}

.is-running .status-dot {
  background: var(--primary);
  box-shadow: 0 0 0 2px var(--info-halo);
  animation: status-pulse 1.2s ease-in-out infinite;
}

.tool-name {
  flex: none;
  color: var(--contrast-foreground-secondary);
  font-family: var(--font-mono);
}

.cwd {
  min-width: 0;
  overflow: hidden;
  color: var(--contrast-foreground-faint);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cwd::before {
  content: "· ";
}

.command-line {
  display: flex;
  gap: var(--spacing-xs);
  max-height: calc(var(--text-code-line) * 6 + var(--spacing-xs) * 2);
  padding: var(--spacing-xs) var(--spacing-sm);
  overflow-y: auto;
  border-top: var(--border-width) solid var(--border-subtle);
  background: var(--code-surface);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: var(--text-code-line);
}

.prompt {
  flex: none;
  color: var(--contrast-foreground-faint);
  user-select: none;
}

.command {
  flex: 1;
  min-width: 0;
  color: var(--contrast-foreground);
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.command-output {
  border-top: var(--border-width) solid var(--border-subtle);
}

.command-output :deep(.tool-output-pre.is-embedded) {
  color: var(--contrast-foreground-secondary);
}

.command-output.is-clamped {
  max-height: calc(var(--text-code-line) * 8 + var(--spacing-xs) * 2);
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black calc(100% - 2.5rem), transparent);
}

/* 运行中贴底显示最新输出，渐隐移到顶部 */
.command-output.is-clamped.is-tail {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  mask-image: linear-gradient(to top, black calc(100% - 2.5rem), transparent);
}

.command-output.is-tail :deep(.tool-output) {
  flex: none;
}

.command-footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--size-icon-button);
  padding: 0 var(--spacing-sm);
  border-top: var(--border-width) solid var(--border-subtle);
  color: var(--contrast-foreground-faint);
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
  background: var(--destructive-bg);
  color: var(--destructive);
}

.is-error .footer-status {
  color: var(--destructive);
}

.is-running .footer-status {
  color: var(--primary);
}

.footer-toggle {
  margin-inline-start: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground);
  font: inherit;
  cursor: pointer;
}

.footer-toggle:hover {
  color: var(--contrast-foreground);
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

  .command-card :deep(.tool-header .actions) {
    transition: none;
  }
}
</style>
