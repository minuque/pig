<template>
  <div
    v-if="shown"
    class="turn-status"
    :data-tone="retry ? 'warning' : undefined"
    data-testid="turn-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <RotateCcwIcon v-if="retry" class="turn-status-icon size-icon-sm" aria-hidden="true" />

    <Minimize2Icon
      v-else-if="compacting"
      class="turn-status-icon size-icon-sm"
      aria-hidden="true"
    />

    <RunningPigGlyph v-else class="turn-status-pig" :state="pigState" />

    <span class="turn-status-label">
      <RollText :text="label" :live="busy" />
      <span v-if="detail" class="turn-status-detail">· {{ detail }}</span>
    </span>

    <span v-if="tokensLabel || elapsedLabel" class="turn-status-meta">
      <template v-if="tokensLabel">
        <FlowNumber :text="tokensLabel" />
        <span v-if="elapsedLabel" class="label-dot">·</span>
      </template>

      <FlowNumber v-if="elapsedLabel" :text="elapsedLabel" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { Minimize2Icon, RotateCcwIcon, RunningPigGlyph } from "@components/icons/index.js"
import { RollText } from "@components/ui/roll-text/index.js"
import FlowNumber from "@features/transcript-view/components/FlowNumber.vue"
import { formatElapsed } from "@utils/time.js"
import type { SessionActivity, SessionPhase } from "@/types/common-type.js"
import { errorSummary } from "@features/transcript-view/lib/error-summary.js"
import {
  createActivityLabelDisplay,
  formatOutputTokens,
  turnActivity,
} from "@features/transcript-view/lib/transcript-activity.js"
import type { TimelineRow } from "@features/transcript-view/type.js"

const props = defineProps<{
  phase: SessionPhase | undefined
  sending: boolean
  stopping: boolean
  startedAt?: number | undefined
  rows?: readonly TimelineRow[] | undefined
  outputTokens?: number | null | undefined
  activity?: SessionActivity | undefined
}>()
const { t } = useI18n()
const retry = computed(() => (props.activity?.kind === "retry" ? props.activity : undefined))
const compacting = computed(() => props.activity?.kind === "compaction")
const detail = computed(() => {
  if (retry.value) return errorSummary(retry.value.errorMessage)

  if (props.activity?.kind === "compaction")
    return t(`transcript.compactionReason.${props.activity.reason}`)
  return ""
})
const phaseLabel = computed(() => {
  switch (props.phase) {
    case "turn":
      return t("transcript.statusWorking")
    case "compaction":
      return t("transcript.compressing")
    case "retry":
      return t("transcript.retrying")
    case "branch_summary":
      return t("transcript.branchSummary")
    default:
      return ""
  }
})
const busy = computed(() => props.stopping || props.phase !== "idle" || props.sending)
const now = shallowRef(Date.now())
const tick = useIntervalFn(
  () => {
    now.value = Date.now()
  },
  1000,
  { immediate: false },
)
const busySince = shallowRef<number>()
const elapsedStart = computed(() => props.startedAt ?? busySince.value)
const elapsedSeconds = computed(() => {
  const start = elapsedStart.value

  if (!busy.value || start === undefined) return 0
  return Math.max(0, Math.floor((now.value - start) / 1000))
})

watch(
  busy,
  (isBusy) => {
    if (isBusy && busySince.value === undefined) busySince.value = now.value

    if (!isBusy) busySince.value = undefined
  },
  { flush: "sync", immediate: true },
)

const activity = computed(() =>
  turnActivity({
    rows: props.rows ?? [],
    phase: props.phase,
    sending: props.sending,
    stopping: props.stopping,
    elapsedSeconds: elapsedSeconds.value,
    now: now.value,
  }),
)
const rawLabel = computed(() => {
  if (props.stopping) return t("transcript.statusStopping")

  if (retry.value) {
    const seconds = Math.ceil((retry.value.retryAt - now.value) / 1000)
    const values = { attempt: retry.value.attempt, max: retry.value.maxAttempts, seconds }
    return seconds > 0
      ? t("transcript.retryCountdown", values)
      : t("transcript.retryAttemptLive", values)
  }

  if (activity.value) return activity.value.label

  if (phaseLabel.value) return phaseLabel.value

  if (props.sending) return t("transcript.statusSending")
  return ""
})
const labelDisplay = createActivityLabelDisplay({})
const displayedLabel = shallowRef(labelDisplay.displayed())
const unsubscribe = labelDisplay.subscribe(() => {
  displayedLabel.value = labelDisplay.displayed()
})

watch(
  [rawLabel, () => activity.value?.kind ?? null, busy],
  ([next, kind, isBusy]) => {
    labelDisplay.update(next, kind, isBusy)
    displayedLabel.value = labelDisplay.displayed()
  },
  { flush: "sync", immediate: true },
)

onBeforeUnmount(() => {
  unsubscribe()
  labelDisplay.destroy()
})

const label = computed(() => displayedLabel.value)
const shown = computed(() => label.value !== "")

watch(
  [shown, busy, () => props.startedAt],
  ([visible, isBusy]) => {
    now.value = Date.now()

    if (visible && isBusy) tick.resume()
    else tick.pause()
  },
  { flush: "sync", immediate: true },
)

const elapsedLabel = computed(() => {
  const start = elapsedStart.value

  if (!busy.value || !shown.value || start === undefined) return ""
  return formatElapsed(now.value - start, { showMs: false })
})
const pigState = computed<"idle" | "run" | "long" | "xlong">(() => {
  if (busy.value) {
    const s = elapsedSeconds.value

    if (s >= 600) return "xlong"

    if (s >= 300) return "long"
    return "run"
  }

  return "idle"
})
const tokensLabel = computed(() => {
  const tokens = props.outputTokens

  if (!busy.value || !tokens || tokens <= 0) return ""
  return t("transcript.tokensCount", { count: formatOutputTokens(tokens) })
})
</script>

<style scoped>
.turn-status {
  display: flex;
  position: relative;
  align-items: center;
  gap: var(--space-xs);
  box-sizing: border-box;
  width: 100%;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  margin-block-end: calc(-1 * var(--composer-radius));
  padding: var(--space-xs) var(--space-sm) calc(var(--space-xs) + var(--composer-radius));
  border-radius: var(--radius-dialog) var(--radius-dialog) 0 0;
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  animation: plate-in var(--duration-normal) var(--ease-out);
}

.turn-status[data-tone] {
  background-image: linear-gradient(var(--tone-subtle), var(--tone-subtle));
  box-shadow: inset 0 0 0 var(--border-width) var(--tone-border);
}

.turn-status-pig {
  flex: none;
  height: calc(var(--text-meta) * var(--text-meta--line-height));
}

.turn-status-icon {
  flex: none;
  color: var(--fg-muted);
}

.turn-status[data-tone] .turn-status-icon {
  color: var(--tone-text);
}

.turn-status-label {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
  color: var(--fg);
}

.turn-status-detail {
  min-width: 0;
  overflow: hidden;
  color: var(--fg-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.turn-status-meta {
  display: flex;
  align-items: center;
  flex: none;
  margin-inline-start: auto;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

.label-dot {
  font-weight: var(--font-weight-bold);
  margin-inline: 0.35em;
}

@media (prefers-reduced-motion: reduce) {
  .turn-status {
    animation: none;
  }
}
</style>
