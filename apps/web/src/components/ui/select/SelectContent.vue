<template>
  <SelectPortal>
    <ThemeRoot>
      <SelectContent
        data-slot="select-content"
        :data-size="size"
        :data-variant="variant"
        :data-accent-color="color"
        :data-high-contrast="highContrast || undefined"
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
    </ThemeRoot>
  </SelectPortal>
</template>

<script setup lang="ts">
import type { SelectContentEmits, SelectContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { useSelectSize } from "@components/ui/select/select-context.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    SelectContentProps & {
      class?: HTMLAttributes["class"]
      variant?: "solid" | "soft"
      color?: string
      highContrast?: boolean
    }
  >(),
  { class: undefined, variant: "solid", position: "popper", highContrast: false },
)
const emits = defineEmits<SelectContentEmits>()
const delegatedProps = reactiveOmit(props, "class", "variant", "color", "highContrast", "position")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SelectContentProps>
const size = useSelectSize()
</script>

<style>
:where([data-slot="select-content"]) {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-card);
  background-color: var(--bg-raised);
  box-shadow:
    0 0 0 var(--border-width) var(--border),
    var(--menu-shadow);
  color: var(--fg);
}

:where([data-slot="select-viewport"]) {
  box-sizing: border-box;
  padding: var(--space-xs);
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
