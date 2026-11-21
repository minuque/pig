<template>
  <SelectPortal>
    <SelectContent
      data-slot="select-content"
      :data-size="size"
      :data-variant="variant"
      :data-tone="color"
      :data-position="position"
      :position="position"
      :side-offset="4"
      :collision-padding="10"
      v-bind="forwarded"
      class="reveal-menu"
      :class="props.class"
    >
      <SelectViewport data-slot="select-viewport">
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>

<script setup lang="ts">
import type { ToneColor } from "@/types/ui-type.js"
import type { SelectContentEmits, SelectContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from "reka-ui"
import { useSelectSize } from "@components/ui/select/select-context.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    SelectContentProps & {
      class?: HTMLAttributes["class"]
      variant?: "solid" | "soft"
      color?: ToneColor
    }
  >(),
  { class: undefined, variant: "soft", position: "popper" },
)
const emits = defineEmits<SelectContentEmits>()
const delegatedProps = reactiveOmit(props, "class", "variant", "color", "position")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SelectContentProps>
const size = useSelectSize()
</script>

<style>
/* 选择框内容：与菜单同一套浮层底、边框与阴影；popper 位置时跟随触发器宽度 */
:where([data-slot="select-content"]) {
  box-sizing: border-box;
  position: relative;
  z-index: var(--z-popover);
  overflow: hidden;
  border-radius: var(--radius-card);
  border: var(--border-width) solid var(--float-border);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  color: var(--fg);
}

:where([data-slot="select-viewport"]) {
  box-sizing: border-box;
  padding: var(--space-xs);
}

/* 行距只有一条：视口里相邻的任意两行之间留一道 --menu-item-gap */
:where([data-slot="select-viewport"]) > * + * {
  margin-block-start: var(--menu-item-gap);
}

:where([data-slot="select-content"][data-size="s"]) {
  border-radius: var(--radius-control);
}

:where([data-slot="select-content"][data-size="s"]) :where([data-slot="select-viewport"]) {
  padding: var(--space-2xs);
}

:where([data-slot="select-content"][data-position="popper"]) {
  min-inline-size: var(--reka-select-trigger-width);
  max-block-size: var(--reka-select-content-available-height);
  transform-origin: var(--reka-select-content-transform-origin);
}
</style>
