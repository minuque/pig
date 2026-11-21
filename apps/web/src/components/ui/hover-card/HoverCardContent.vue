<template>
  <HoverCardPortal>
    <HoverCardContent
      data-slot="hover-card-content"
      :data-size="size"
      :align="align"
      :side-offset="8"
      :collision-padding="10"
      v-bind="forwarded"
      class="reveal-menu"
      :class="props.class"
      :style="widthStyle"
    >
      <slot />
    </HoverCardContent>
  </HoverCardPortal>
</template>

<script setup lang="ts">
import type { HoverCardContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { HoverCardContent, HoverCardPortal, useForwardProps } from "reka-ui"
import type { Size } from "@/types/ui-type.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    HoverCardContentProps & {
      class?: HTMLAttributes["class"]
      /** 内边距档：s、m、l */
      size?: Size
      align?: "start" | "center" | "end"
      /** 面板最大宽度，默认沿用 rt 的 480px */
      maxWidth?: string
    }
  >(),
  { class: undefined, size: "m", align: "start", maxWidth: "480px" },
)
const delegatedProps = reactiveOmit(props, "class", "size", "align", "maxWidth")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<HoverCardContentProps>
const widthStyle = computed(() => ({ maxInlineSize: props.maxWidth }))
</script>

<style>
/* 悬停卡：与浮卡同一套浮层底、边框与阴影 */
:where([data-slot="hover-card-content"]) {
  box-sizing: border-box;
  position: relative;
  z-index: var(--z-popover);
  overflow: auto;
  border: var(--border-width) solid var(--float-border);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  transform-origin: var(--reka-hover-card-content-transform-origin);
}

:where([data-slot="hover-card-content"][data-size="s"]) {
  padding: var(--space-sm);
  border-radius: var(--radius-card);
}

:where([data-slot="hover-card-content"][data-size="m"]) {
  padding: var(--space-md);
  border-radius: var(--radius-card);
}

:where([data-slot="hover-card-content"][data-size="l"]) {
  padding: var(--space-lg);
  border-radius: var(--radius-card);
}
</style>
