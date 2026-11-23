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
    <slot name="actions" />

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
    copyBefore?: boolean
    pinned?: boolean
  }>(),
  { text: "", copyBefore: false, pinned: false },
)
const { t, locale } = useI18n()
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

.stamp :deep(.copy-button) {
  position: static;
}
</style>
