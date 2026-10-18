<template>
  <div v-if="shown" class="turn-status" data-testid="turn-status" role="status">
    <RunningPigGlyph class="turn-status-pig" :idle="!busy" />

    <span class="turn-status-label" :class="{ shimmer: busy }" :data-text="label">
      {{ label }}
      <template v-if="elapsedLabel">
        <span class="label-dot">·</span>
        {{ elapsedLabel }}
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { RunningPigGlyph } from "@components/icons/index.js"
import type { SessionPhase } from "@/types/common-type.js"

const props = defineProps<{
  phase: SessionPhase | undefined
  sending: boolean
  stopping: boolean
  /** 当前轮的毫秒时间戳；没有则不计时 */
  startedAt?: number | undefined
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
/** sending/stopping 优先于 phase；都为空时整行不渲染。 */
const label = computed(() => {
  if (props.stopping) return t("transcript.statusStopping")

  if (phaseLabel.value) return phaseLabel.value

  if (props.sending) return t("transcript.statusSending")
  return ""
})
const busy = computed(() => props.stopping || props.phase !== "idle" || props.sending)
const shown = computed(() => label.value !== "")
const now = shallowRef(Date.now())
const tick = useIntervalFn(
  () => {
    now.value = Date.now()
  },
  1000,
  { immediate: false },
)

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
  const start = props.startedAt

  if (!shown.value || start === undefined) return ""
  const seconds = Math.max(0, Math.floor((now.value - start) / 1000))
  return `${seconds}s`
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
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
}

/* 图标高度对齐一行文本，不撑开行距 */
.turn-status-pig {
  font-size: var(--text-body-sm);
  height: calc(var(--text-body-sm) * var(--text-body-sm--line-height));
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
