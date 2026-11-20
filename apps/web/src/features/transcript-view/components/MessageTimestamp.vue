<template>
  <div
    v-if="valid"
    class="stamp"
    :data-pinned="pinned || undefined"
    :data-copy-before="copyBefore || undefined"
    role="toolbar"
    :aria-label="t('transcript.messageActions')"
  >
    <CopyButton v-if="text" :text="text" />

    <Tooltip>
      <TooltipTrigger as-child>
        <time class="stamp-time" :datetime="iso">{{ relative }}</time>
      </TooltipTrigger>

      <TooltipContent side="top">{{ full }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useNow } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
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
</script>

<style scoped>
/* 消息底栏：复制在前、时间在后，高度与图标按钮一致；时间不可聚焦，悬停看完整日期 */
.stamp {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  width: fit-content;
  min-height: var(--control-sm);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.stamp[data-copy-before] {
  flex-direction: row-reverse;
}

.stamp-time {
  padding-inline: var(--space-2xs);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

/* 复用的复制按钮默认钉在卡片角上，这里回到时间条里随流排 */
.stamp :deep(.copy-button) {
  position: static;
}
</style>
