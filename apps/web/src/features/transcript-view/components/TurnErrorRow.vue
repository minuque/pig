<template>
  <Callout variant="surface" size="s" :color="error ? 'destructive' : 'warning'" role="alert">
    <template #icon><DangerCircleIcon /></template>
    <template v-if="message" #title>{{ label }}</template>
    {{ message || label }}
  </Callout>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Callout } from "@components/ui/callout/index.js"
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
