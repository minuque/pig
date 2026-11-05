<template>
  <div class="tool-run">
    <button
      type="button"
      class="tool-run-summary"
      :aria-expanded="open"
      @click="emit('toggleExpand', !open)"
    >
      <RollText :text="labelText" :live="labelLive" />

      <span v-if="summary.lineChange.added || summary.lineChange.removed" class="tool-run-counts">
        <span v-if="summary.lineChange.added" class="added">+{{ summary.lineChange.added }}</span>

        <span v-if="summary.lineChange.removed" class="removed">
          -{{ summary.lineChange.removed }}
        </span>
      </span>

      <span v-if="duration" class="tool-run-time">{{ duration }}</span>
      <AltArrowRightIcon class="tool-run-caret" :class="{ 'is-open': open }" data-icon="inline" />
    </button>

    <ToolRunCard
      v-if="open"
      :calls="calls"
      :expanded-tools="expandedTools"
      @toggle-tool="(id, value) => emit('toggleTool', id, value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { AltArrowRightIcon } from "@components/icons/index.js"
import RollText from "@features/transcript-view/components/RollText.vue"
import ToolRunCard from "@features/transcript-view/components/tool/ToolRunCard.vue"
import {
  runningToolLabel,
  toolCalls,
  toolRunSummary,
} from "@features/transcript-view/lib/tool-run.js"
import type { ToolRow as ToolRowModel } from "@features/transcript-view/type.js"
import { formatElapsed } from "@utils/time.js"

const HOLD_MS = 650
const props = defineProps<{
  row: ToolRowModel
  expanded: boolean | undefined
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{
  toggleExpand: [open: boolean]
  toggleTool: [id: string, open: boolean]
}>()
const { t } = useI18n()
const calls = computed(() => toolCalls(props.row))
const duration = computed(() => {
  const { startedAt, endedAt } = props.row

  if (startedAt === undefined || endedAt === undefined) return ""
  return endedAt - startedAt >= 1000 ? formatElapsed(endedAt - startedAt) : ""
})
const open = computed(() => props.expanded ?? false)
const summary = computed(() => toolRunSummary(props.row))
const settledLabel = computed(() => {
  const parts = summary.value.parts.map((part) =>
    part.kind === "text" ? part.text : `${part.prefix} ${part.count} ${part.suffix}`,
  )
  const label = parts.join(", ")
  const failed = summary.value.failCount
  return failed ? `${label}${t("transcript.failedCount", { count: failed })}` : label
})
const live = computed(() => runningToolLabel(props.row))
const displayLive = ref<string | null>(live.value)
let holdTimer: ReturnType<typeof setTimeout> | undefined

watch(
  live,
  (next) => {
    if (holdTimer) {
      clearTimeout(holdTimer)
      holdTimer = undefined
    }

    if (next) {
      displayLive.value = next
      return
    }

    if (!displayLive.value) return
    holdTimer = setTimeout(() => {
      holdTimer = undefined
      displayLive.value = null
    }, HOLD_MS)
  },
  { flush: "sync" },
)

const labelText = computed(() => displayLive.value ?? settledLabel.value)
const labelLive = computed(() => displayLive.value !== null)

onBeforeUnmount(() => {
  if (holdTimer) clearTimeout(holdTimer)
})
</script>

<style scoped>
.tool-run {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tool-run-summary {
  display: flex;
  align-self: flex-start;
  align-items: center;
  gap: var(--space-xxs);
  max-width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-muted);
  font: inherit;
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-run-summary:hover,
.tool-run-summary:focus-visible,
.tool-run-summary[aria-expanded="true"] {
  color: var(--contrast-foreground-secondary);
}

.tool-run-counts {
  display: flex;
  flex: none;
  gap: var(--space-xxs);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.tool-run-time {
  flex: none;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.added {
  padding: 0 var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--success-bg);
  color: var(--success);
}

.removed {
  padding: 0 var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--danger-bg);
  color: var(--danger);
}

.tool-run-caret {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  transition: transform var(--duration-fast) var(--ease-out);
}

.tool-run-caret.is-open {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .tool-run-caret {
    transition: none;
  }
}
</style>
