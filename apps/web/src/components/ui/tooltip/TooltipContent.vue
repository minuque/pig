<template>
  <TooltipPortal>
    <ThemeRoot>
      <TooltipContent
        data-slot="tooltip-content"
        v-bind="{ ...$attrs, ...forwarded }"
        class="reveal-menu"
        :class="props.class"
      >
        <p data-slot="tooltip-text">
          <slot />
        </p>

        <TooltipArrow data-slot="tooltip-arrow" />
      </TooltipContent>
    </ThemeRoot>
  </TooltipPortal>
</template>

<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined, sideOffset: 4, collisionPadding: 10 },
)
const emits = defineEmits<TooltipContentEmits>()
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<TooltipContentProps>
</script>

<style>
/* 提示气泡：反色底 + 反色字，字号取最小档 */
:where([data-slot="tooltip-content"]) {
  box-sizing: border-box;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  background-color: var(--gray-12);
  transform-origin: var(--reka-tooltip-content-transform-origin);
}

:where([data-slot="tooltip-text"]) {
  color: var(--gray-1);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  user-select: none;
  cursor: default;
}

:where([data-slot="tooltip-arrow"]) {
  fill: var(--gray-12);
}
</style>
