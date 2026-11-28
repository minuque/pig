<template>
  <TooltipRoot :delay="400" v-bind="$attrs">
    <slot />
  </TooltipRoot>
</template>

<script setup lang="ts">
import { computed, provide, useAttrs } from "vue"
import { Tooltip as TooltipRoot } from "@ui-sdk/vue/tooltip"
import { tooltipShortcutKey } from "./shortcut-key.js"

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()

provide(
  tooltipShortcutKey,
  computed(() => attrs["shortcut"] as string | undefined),
)
</script>
