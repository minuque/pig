<template>
  <TabsList
    data-slot="tabs-list"
    :data-accent-color="color"
    class="rt-BaseTabList rt-TabsList"
    :class="[sizeClass, highContrast && 'rt-high-contrast', props.class]"
  >
    <slot />
  </TabsList>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { TabsList } from "reka-ui"
import { sizeClass as rtSizeClass } from "@components/ui/rt/size.js"

/** rt 的标签栏只有 1、2 两档，对应这里的 s、m */
const props = withDefaults(
  defineProps<{
    size?: "s" | "m"
    color?: string | undefined
    highContrast?: boolean
    class?: HTMLAttributes["class"] | undefined
  }>(),
  { size: "m", color: undefined, highContrast: false, class: undefined },
)
const sizeClass = computed(() => rtSizeClass(props.size))
</script>
