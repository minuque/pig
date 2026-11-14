<template>
  <div
    v-if="valid"
    class="stamp"
    :data-pinned="pinned || undefined"
    :data-status="status === 'idle' ? undefined : status"
    :data-copy-before="copyBefore || undefined"
    role="toolbar"
    :aria-label="t('transcript.messageActions')"
  >
    <Tooltip v-if="text">
      <TooltipTrigger as-child>
        <IconButton
          type="button"
          variant="ghost"
          color="gray"
          size="s"
          class="stamp-copy"
          :aria-label="copyLabel"
          @click="copy"
        >
          <CheckIcon v-if="status === 'copied'" class="size-icon" />
          <CopyIcon v-else class="size-icon" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ copyLabel }}</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger as-child>
        <time class="stamp-time" :datetime="iso">{{ relative }}</time>
      </TooltipTrigger>

      <TooltipContent side="top">{{ full }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useNow, useTimeoutFn } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { CheckIcon, CopyIcon } from "@components/icons/index.js"
import { formatRelative } from "@utils/time.js"

const props = withDefaults(
  defineProps<{
    timestamp: number
    text?: string
    /** 复制按钮放在时间后面（用户消息靠右，时间贴着气泡外侧）。 */
    copyBefore?: boolean
    /** 常驻显示，不等悬停。 */
    pinned?: boolean
  }>(),
  { text: "", copyBefore: false, pinned: false },
)
const { t, locale } = useI18n()
// 相对时间按分钟走
const now = useNow({ interval: 60_000 })
const valid = computed(() => Number.isFinite(props.timestamp) && props.timestamp > 0)
const date = computed(() => new Date(props.timestamp))
const iso = computed(() => (valid.value ? date.value.toISOString() : ""))
const relative = computed(() =>
  valid.value ? formatRelative(props.timestamp, now.value.getTime(), locale.value) : "",
)
const full = computed(() =>
  valid.value
    ? new Intl.DateTimeFormat(locale.value, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date.value)
    : "",
)
const status = shallowRef<"idle" | "copied" | "error">("idle")
const copyLabel = computed(() =>
  status.value === "copied"
    ? t("common.copied")
    : status.value === "error"
      ? t("common.copyFailed")
      : t("common.copyMessage"),
)
const { start, stop } = useTimeoutFn(() => (status.value = "idle"), 1500, { immediate: false })

async function copy() {
  if (!props.text) return
  stop()

  try {
    await navigator.clipboard.writeText(props.text)
    status.value = "copied"
    start()
  } catch {
    status.value = "error"
  }
}
</script>

<style scoped>
/* 消息底栏：复制在前、时间在后，高度与图标按钮一致；时间不可聚焦，悬停看完整日期 */
.stamp {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  width: fit-content;
  min-height: var(--size-icon-button);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.stamp[data-copy-before] {
  flex-direction: row-reverse;
}

.stamp-time {
  padding-inline: var(--space-xxs);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.stamp[data-status="copied"] .stamp-copy {
  color: var(--success);
}

.stamp[data-status="error"] .stamp-copy {
  color: var(--danger);
}
</style>
