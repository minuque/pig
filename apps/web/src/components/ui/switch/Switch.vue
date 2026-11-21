<template>
  <SwitchRoot
    data-slot="switch"
    v-bind="forwarded"
    :data-tone="color"
    :data-size="size"
    :class="props.class"
  >
    <SwitchThumb data-slot="switch-thumb" />
  </SwitchRoot>
</template>

<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from "reka-ui"
import type { Size, ToneColor } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<
    SwitchRootProps<boolean> & {
      class?: HTMLAttributes["class"]
      size?: Size
      color?: ToneColor
    }
  >(),
  { class: undefined, size: "m" },
)
const emits = defineEmits<SwitchRootEmits<boolean>>()
const delegatedProps = reactiveOmit(props, "class", "size", "color")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<
  SwitchRootProps<boolean>
>
</script>

<style>
:where([data-slot="switch"]) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  vertical-align: top;
  padding: 2px;
  border-radius: var(--radius-pill);
  background-color: var(--border-input);
  cursor: pointer;
  transition:
    background-color var(--duration-normal) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out);
}

:where([data-slot="switch"][data-state="checked"]) {
  background-color: var(--tone);
}

:where([data-slot="switch"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="switch"][data-disabled]) {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
}

:where([data-slot="switch-thumb"]) {
  display: block;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background-color: var(--bg);
  box-shadow: 0 1px 2px var(--thumb-shadow);
  pointer-events: none;
  transform-origin: left center;
  transition: transform var(--duration-fast) var(--ease-out);
}

:where([data-slot="switch-thumb"][data-state="checked"]) {
  transform-origin: right center;
}

html.dark :where([data-slot="switch-thumb"][data-state="unchecked"]) {
  background-color: var(--fg-muted);
}

:where([data-slot="switch"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-state="unchecked"]) {
  transform: scaleX(1.1);
}

:where([data-slot="switch"][data-size="s"]) {
  inline-size: calc(calc(var(--spacing) * 3.5) * 2 - 2px);
  block-size: calc(calc(var(--spacing) * 3.5) + 2px);
}

:where([data-slot="switch"][data-size="s"]) :where([data-slot="switch-thumb"]) {
  inline-size: calc(calc(var(--spacing) * 3.5) - 2px);
  block-size: calc(calc(var(--spacing) * 3.5) - 2px);
}

:where([data-slot="switch"][data-size="s"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(calc(var(--spacing) * 3.5) - 4px));
}

:where([data-slot="switch"][data-size="s"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(calc(var(--spacing) * 3.5) - 4px)) scaleX(1.1);
}

:where([data-slot="switch"][data-size="m"]) {
  inline-size: calc(calc(var(--spacing) * 4) * 2 - 2px);
  block-size: calc(calc(var(--spacing) * 4) + 2px);
}

:where([data-slot="switch"][data-size="m"]) :where([data-slot="switch-thumb"]) {
  inline-size: calc(calc(var(--spacing) * 4) - 2px);
  block-size: calc(calc(var(--spacing) * 4) - 2px);
}

:where([data-slot="switch"][data-size="m"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(calc(var(--spacing) * 4) - 4px));
}

:where([data-slot="switch"][data-size="m"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(calc(var(--spacing) * 4) - 4px)) scaleX(1.1);
}

:where([data-slot="switch"][data-size="l"]) {
  inline-size: calc(calc(var(--spacing) * 5) * 2 - 2px);
  block-size: calc(calc(var(--spacing) * 5) + 2px);
}

:where([data-slot="switch"][data-size="l"]) :where([data-slot="switch-thumb"]) {
  inline-size: calc(calc(var(--spacing) * 5) - 2px);
  block-size: calc(calc(var(--spacing) * 5) - 2px);
}

:where([data-slot="switch"][data-size="l"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(calc(var(--spacing) * 5) - 4px));
}

:where([data-slot="switch"][data-size="l"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(calc(var(--spacing) * 5) - 4px)) scaleX(1.1);
}
</style>
