<template>
  <Button :variant="variant" :size="size" :disabled="disabled">
    <SettingsIcon v-if="size === 'icon'" />
    <template v-else>{{ label }}</template>
  </Button>
</template>

<script setup lang="ts">
import { SettingsIcon } from "@components/icons/index.js"
import { Button, type ButtonSize, type ButtonVariant } from "@components/ui/button/index.js"

withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    label?: string
  }>(),
  { variant: "default", size: "default", disabled: false, label: "保存" },
)
</script>
