<template>
  <div class="turn-error" :data-error="error || undefined" role="alert">
    <div class="turn-error-head">
      <CircleExclamationPointIcon v-if="error" class="size-icon" />
      <SquareIcon v-else class="size-icon" />
      {{ label }}
    </div>

    <div v-if="message" class="turn-error-message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { CircleExclamationPointIcon, SquareIcon } from "@components/icons/index.js"

const props = defineProps<{
  error: boolean
  message?: string | undefined
  retryCount?: number | undefined
}>()
const { t } = useI18n()
const label = computed(() => {
  const base = props.error ? t("transcript.error") : t("transcript.aborted")
  const retries = props.retryCount

  if (retries && retries > 1) return t("transcript.retryTimes", { base, retries })
  return base
})
</script>

<style scoped>
/* 照 markdown 引用块排：左竖线加缩进；出错时竖线与标题染危险色，中止保持灰 */
.turn-error {
  padding-inline-start: var(--space-xs);
  color: var(--contrast-foreground-faint);
  border-inline-start: var(--border-width-quote) solid var(--border-soft);
}

.turn-error[data-error] {
  border-inline-start-color: var(--danger);
}

.turn-error-head {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
}

.turn-error[data-error] .turn-error-head {
  color: var(--danger);
}

.turn-error-message {
  margin-block-start: var(--space-xxs);
  color: var(--contrast-foreground-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
