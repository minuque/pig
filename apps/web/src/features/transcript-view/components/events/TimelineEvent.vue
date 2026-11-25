<template>
  <Collapsible :open="open" class="timeline-event">
    <div
      class="event-divider"
      :role="expandable ? undefined : 'separator'"
      :data-tone="failed ? 'danger' : undefined"
    >
      <component
        :is="expandable ? 'button' : 'span'"
        class="event-pill"
        v-bind="expandable ? { type: 'button', 'aria-expanded': open } : {}"
        @click="expandable && emit('toggle', !open)"
      >
        <template v-for="(part, index) in row.parts" :key="index">
          <span v-if="index > 0" class="event-sep" aria-hidden="true">·</span>
          <ModelSwitch v-if="part.kind === 'model'" :from="part.from" :to="part.to" />

          <span v-else class="event-part">
            <component :is="PART_ICON[part.kind]" class="size-icon" aria-hidden="true" />
            <span class="event-label">{{ partLabel(part) }}</span>
            <span v-if="partDetail(part)" class="event-detail">· {{ partDetail(part) }}</span>
          </span>
        </template>

        <ChevronRightIcon v-if="expandable" class="event-chevron size-icon" aria-hidden="true" />
      </component>
    </div>

    <CollapsibleContent v-if="expandable">
      <div class="event-panel">
        <MarkdownContent v-if="summary" :nodes="nodes" :streaming="false" />

        <p v-for="(message, index) in failures" :key="index" class="event-error">
          {{ message }}
        </p>

        <ol
          v-for="(part, partIndex) in retries"
          :key="`${part.attempts[0]?.timestamp ?? 0}-${partIndex}`"
          class="event-attempts"
        >
          <li v-for="(attempt, index) in part.attempts" :key="`${attempt.timestamp}-${index}`">
            <span class="event-attempt-head">
              {{ t("transcript.retryAttempt", { index: index + 1 }) }}
            </span>

            <span class="event-attempt-error">{{ errorSummary(attempt.errorMessage) }}</span>
          </li>
        </ol>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue"
import { useI18n } from "@i18n/index.js"
import { Collapsible, CollapsibleContent } from "@pig/ui/collapsible"
import {
  ChevronRightIcon,
  CircleExclamationPointIcon,
  GitBranchIcon,
  Minimize2Icon,
  RotateCcwIcon,
  SquareIcon,
} from "@components/icons/index.js"
import ModelSwitch from "@features/transcript-view/components/events/ModelSwitch.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import { formatOutputTokens } from "@features/transcript-view/lib/transcript-activity.js"
import { errorSummary } from "@features/transcript-view/lib/error-summary.js"
import type { EventPart, EventRow } from "@features/transcript-view/type.js"

type LabeledPart = Exclude<EventPart, { kind: "model" }>

const props = defineProps<{ row: EventRow; open: boolean }>()
const emit = defineEmits<{ toggle: [open: boolean] }>()
const { t } = useI18n()
const PART_ICON: Record<LabeledPart["kind"], Component> = {
  compaction: Minimize2Icon,
  branch_summary: GitBranchIcon,
  compaction_failed: CircleExclamationPointIcon,
  retry_recovered: RotateCcwIcon,
  aborted: SquareIcon,
}
const failed = computed(() => props.row.parts.some((part) => part.kind === "compaction_failed"))
const summary = computed(() =>
  props.row.parts
    .flatMap((part) =>
      part.kind === "compaction" || part.kind === "branch_summary" ? [part.summary] : [],
    )
    .join("\n\n---\n\n"),
)
const retries = computed(() =>
  props.row.parts.flatMap((part) => (part.kind === "retry_recovered" ? [part] : [])),
)
const failures = computed(() =>
  props.row.parts.flatMap((part) =>
    part.kind === "compaction_failed" && part.errorMessage ? [part.errorMessage] : [],
  ),
)
const expandable = computed(
  () => summary.value !== "" || retries.value.length > 0 || failures.value.length > 0,
)
const nodes = useMarkdownNodes({
  text: () => summary.value,
  streaming: () => false,
  cacheKey: () => `event:${props.row.id}`,
})

function partLabel(part: LabeledPart): string {
  switch (part.kind) {
    case "compaction":
      return t("transcript.compacted")
    case "branch_summary":
      return t("transcript.branchSummary")
    case "compaction_failed":
      return t("transcript.compactionFailed")
    case "retry_recovered":
      return t("transcript.retryRecovered", part.attempts.length)
    case "aborted":
      return t("transcript.aborted")
  }
}

function partDetail(part: LabeledPart): string {
  if (props.row.parts.length > 1) return ""

  if (part.kind === "compaction")
    return t("transcript.tokensCount", { count: formatOutputTokens(part.tokensBefore) })

  if (part.kind === "compaction_failed") return errorSummary(part.errorMessage)
  return ""
}
</script>

<style scoped>
.event-divider {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.event-divider::before,
.event-divider::after {
  flex: 1;
  block-size: var(--border-width);
  background: var(--border);
  content: "";
}

.event-divider[data-tone="danger"] {
  color: var(--danger-text);
}

.event-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 0;
  max-inline-size: 85%;
  padding: var(--space-2xs) var(--space-sm);
  border: 0;
  border-radius: var(--radius-pill);
  corner-shape: round;
  background: transparent;
  color: inherit;
  font: inherit;
}

button.event-pill {
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

button.event-pill:hover,
button.event-pill[aria-expanded="true"] {
  background: var(--bg-hover);
  color: var(--fg);
}

.event-part {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  min-inline-size: 0;
}

.event-label {
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.event-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-sep {
  opacity: 0.5;
}

.event-chevron {
  transition: transform var(--duration-fast) var(--ease-out);
}

[aria-expanded="true"] > .event-chevron {
  transform: rotate(90deg);
}

.event-panel {
  display: grid;
  gap: var(--space-xs);
  margin-block-start: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  color: var(--fg-secondary);
}

.event-error {
  margin: 0;
  color: var(--danger-text);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.event-attempts {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.event-attempt-head {
  display: block;
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.event-attempt-error {
  overflow-wrap: anywhere;
}
</style>
