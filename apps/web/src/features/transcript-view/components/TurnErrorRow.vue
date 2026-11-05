<template>
  <div class="turn-error" :class="error ? 'is-error' : 'is-aborted'" role="alert">
    <DangerCircleIcon class="turn-error-icon" />
    <span class="turn-error-label">{{ label }}</span>
    <span v-if="message" class="turn-error-message">{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { DangerCircleIcon } from "@components/icons/index.js"

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
.turn-error {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  min-width: 0;
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
}

.is-error {
  color: var(--danger);
}

.is-aborted {
  color: var(--warning);
}

.turn-error-icon {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  translate: 0 0.15em;
}

.turn-error-label {
  flex: none;
}

.turn-error-message {
  min-width: 0;
  color: var(--contrast-foreground-muted);
  overflow-wrap: anywhere;
}
</style>
