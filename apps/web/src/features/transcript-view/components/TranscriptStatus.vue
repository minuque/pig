<template>
  <div
    v-if="shown"
    class="turn-status"
    data-testid="turn-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <RunningPigGlyph class="turn-status-pig" :state="pigState" />

    <span class="turn-status-label">
      <template v-if="elapsedLabel">
        <FlowNumber :text="elapsedLabel" />
        <span class="label-dot">·</span>
      </template>

      <template v-if="tokensLabel">
        <FlowNumber :text="tokensLabel" />
        <span class="label-dot">·</span>
      </template>

      <RollText :text="label" :live="busy" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { RunningPigGlyph } from "@components/icons/index.js"
import { RollText } from "@components/ui/roll-text/index.js"
import FlowNumber from "@features/transcript-view/components/FlowNumber.vue"
import { formatElapsed } from "@utils/time.js"
import type { SessionPhase } from "@/types/common-type.js"
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
}>()
const { t } = useI18n()
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
const idleLinger = shallowRef(false)
const shown = computed(() => label.value !== "" || idleLinger.value)

watch(
  busy,
  (isBusy, wasBusy) => {
    if (isBusy) idleLinger.value = false
    else if (wasBusy) idleLinger.value = true
  },
  { flush: "sync" },
)

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
  align-items: center;
  gap: var(--space-xs);
  box-sizing: border-box;
  width: 100%;
  padding-block-start: var(--space-md);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.turn-status-pig {
  flex: none;
  height: calc(var(--text-meta) * var(--text-meta--line-height));
}

.turn-status-label {
  display: flex;
  align-items: center;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.label-dot {
  font-weight: var(--font-weight-bold);
  margin-inline: 0.35em;
}
</style>
