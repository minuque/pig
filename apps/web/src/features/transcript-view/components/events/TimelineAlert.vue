<template>
  <Collapsible :open="open" class="timeline-alert" :data-level="row.level" role="alert">
    <button type="button" class="alert-head" :aria-expanded="open" @click="emit('toggle', !open)">
      <component :is="icon" class="size-icon alert-icon" aria-hidden="true" />
      <span class="alert-label">{{ label }}</span>

      <OverflowTooltip v-if="summary" class="alert-summary" :content="summary">
        · {{ summary }}
      </OverflowTooltip>

      <ChevronRightIcon class="alert-chevron size-icon" aria-hidden="true" />
    </button>

    <CollapsibleContent>
      <div class="alert-raw">
        <pre>{{ row.message }}</pre>
        <CopyButton class="alert-copy" :text="row.message" />
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Collapsible, CollapsibleContent } from "@pig/ui/collapsible"
import { OverflowTooltip } from "@pig/ui/tooltip"
import {
  ChevronRightIcon,
  CircleExclamationPointIcon,
  TriangleAlertIcon,
} from "@components/icons/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import { errorSummary } from "@features/transcript-view/lib/error-summary.js"
import type { AlertRow } from "@features/transcript-view/type.js"

const props = defineProps<{ row: AlertRow; open: boolean }>()
const emit = defineEmits<{ toggle: [open: boolean] }>()
const { t } = useI18n()
const icon = computed(() =>
  props.row.level === "warning" ? TriangleAlertIcon : CircleExclamationPointIcon,
)
const label = computed(() => {
  if (props.row.source === "extension") return t("transcript.extensionNotice")
  return props.row.retries > 0
    ? t("transcript.requestFailedRetried", props.row.retries)
    : t("transcript.requestFailed")
})
const summary = computed(() => errorSummary(props.row.message))
</script>

<style scoped>
.timeline-alert {
  color: var(--danger-text);
}

.timeline-alert[data-level="warning"] {
  color: var(--warning-text);
}

.alert-head {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  inline-size: 100%;
  min-inline-size: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.alert-label {
  flex-shrink: 0;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.alert-summary {
  min-inline-size: 0;
  overflow: hidden;
  color: var(--fg-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-chevron {
  flex: none;
  color: var(--fg-muted);
  transition: transform var(--duration-fast) var(--ease-out);
}

.alert-head:hover .alert-summary,
.alert-head:hover .alert-chevron,
.alert-head[aria-expanded="true"] .alert-chevron {
  color: var(--fg);
}

.alert-head[aria-expanded="true"] .alert-chevron {
  transform: rotate(90deg);
}

.alert-raw {
  position: relative;
  margin-block-start: var(--space-xs);
}

.alert-raw pre {
  margin: 0;
  padding: var(--space-xs) calc(var(--control-sm) + var(--space-xs)) var(--space-xs) var(--space-sm);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.alert-copy {
  position: absolute;
  inset-block-start: var(--space-2xs);
  inset-inline-end: var(--space-2xs);
}
</style>
