<template>
  <Button type="button" :size="size" :variant="variant" color="neutral" @click="run">
    <RotateCwIcon class="size-icon" :class="{ 'is-spinning': pending }" />
    {{ label ?? t("common.retry") }}
  </Button>
</template>

<script setup lang="ts">
import { shallowRef } from "vue"
import { Button } from "@pig/ui/button"
import { useI18n } from "@i18n/index.js"
import { RotateCwIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    action: () => unknown
    label?: string | undefined
    size?: "s" | "m"
    variant?: "secondary" | "ghost"
  }>(),
  { label: undefined, size: "m", variant: "secondary" },
)
const { t } = useI18n()
const pending = shallowRef(false)

async function run() {
  if (pending.value) return
  pending.value = true

  try {
    await props.action()
  } finally {
    pending.value = false
  }
}
</script>
