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

    <span class="turn-status-label" :class="{ shimmer: busy }" :data-text="label">
      {{ label }}
      <template v-if="elapsedLabel">
        <span class="label-dot">·</span>
        {{ elapsedLabel }}
      </template>

      <template v-if="tokensLabel">
        <span class="label-dot">·</span>
        {{ tokensLabel }}
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { RunningPigGlyph } from "@components/icons/index.js"
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
  /** 当前轮的毫秒时间戳；没有则不计时 */
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
/** busy 起点：startedAt 缺省时以刚进入 busy 的 now 锁存。 */
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
const shown = computed(() => label.value !== "")

watch(
  [shown, () => props.startedAt],
  ([visible]) => {
    now.value = Date.now()

    if (visible) tick.resume()
    else tick.pause()
  },
  { flush: "sync", immediate: true },
)

const elapsedLabel = computed(() => {
  const start = elapsedStart.value

  if (!shown.value || start === undefined) return ""
  const seconds = Math.max(0, Math.floor((now.value - start) / 1000))
  return `${seconds}s`
})
/** 小猪状态：busy 5min → long，10min → xlong，否则 run；非 busy 看 shown 区分 idle/ready。 */
const pigState = computed<"idle" | "run" | "long" | "xlong" | "ready">(() => {
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
  gap: var(--spacing-xs);
  box-sizing: border-box;
  width: 100%;
  padding-block-start: var(--spacing-md);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

/* 图标高度对齐一行文本，不撑开行距 */
.turn-status-pig {
  font-size: var(--text-meta);
  height: calc(var(--text-meta) * var(--text-meta--line-height));
}

.turn-status-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.label-dot {
  font-weight: var(--font-weight-bold);
  margin-inline: 0.35em;
}
</style>
