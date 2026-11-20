<template>
  <SwitchRoot
    data-slot="switch"
    v-bind="forwarded"
    :data-accent-color="color"
    :data-size="size"
    :data-variant="variant"
    :data-radius="radius"
    :class="props.class"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :data-high-contrast="highContrast || undefined"
      :data-state="forwarded.modelValue ? 'checked' : 'unchecked'"
    />
  </SwitchRoot>
</template>

<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from "reka-ui"
import type { Size } from "@components/ui/rt/size.js"

const props = withDefaults(
  defineProps<
    SwitchRootProps<boolean> & {
      class?: HTMLAttributes["class"]
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "classic" | "surface" | "soft"
      color?: string
      radius?: "none" | "small" | "medium" | "large" | "full"
      highContrast?: boolean
    }
  >(),
  { class: undefined, size: "m", variant: "surface", highContrast: false },
)
const emits = defineEmits<SwitchRootEmits<boolean>>()
const delegatedProps = reactiveOmit(
  props,
  "class",
  "size",
  "variant",
  "color",
  "radius",
  "highContrast",
)
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<
  SwitchRootProps<boolean>
>
</script>

<style>
/* 开关：轨道宽度是高度的 1.75 倍，滑块内缩 1px，勾选时整体右移轨道与高度之差 */
:where([data-slot="switch"]) {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  vertical-align: top;
  cursor: pointer;
}

:where([data-slot="switch"])::before {
  content: "";
  display: block;
  border-radius: var(--radius-control);
  background-repeat: no-repeat;
  transition:
    background-position 120ms linear,
    background-color 140ms var(--ease-in-out),
    box-shadow 140ms var(--ease-in-out),
    filter 140ms var(--ease-in-out);
}

:where([data-slot="switch"][data-size="s"]) {
  height: var(--space-md);
}

:where([data-slot="switch"][data-size="s"])::before {
  width: calc(var(--space-md) * 1.75);
  height: var(--space-md);
  border-radius: calc(var(--radius-control) / 2);
  background-size: calc(var(--space-md) * 4.5) 100%;
}

:where([data-slot="switch"][data-size="m"]) {
  height: calc(var(--space-lg) * 5 / 6);
}

:where([data-slot="switch"][data-size="m"])::before {
  width: calc(var(--space-lg) * 5 / 6 * 1.75);
  height: calc(var(--space-lg) * 5 / 6);
  background-size: calc(var(--space-lg) * 5 / 6 * 4.5) 100%;
}

:where([data-slot="switch"][data-size="l"]) {
  height: var(--space-lg);
}

:where([data-slot="switch"][data-size="l"])::before {
  width: calc(var(--space-lg) * 1.75);
  height: var(--space-lg);
  background-size: calc(var(--space-lg) * 4.5) 100%;
}

:where([data-slot="switch"][data-state="unchecked"])::before {
  background-position-x: 100%;
}

:where([data-slot="switch"][data-state="checked"])::before {
  background-position-x: 0;
}

:where([data-slot="switch"]:active)::before {
  transition-duration: 30ms;
}

:where([data-slot="switch"]:focus-visible)::before {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="switch"][data-disabled]) {
  cursor: default;
}

/* 滑块：白底 + 描边式阴影，勾选时右移 */
:where([data-slot="switch-thumb"]) {
  position: absolute;
  inset-inline-start: 1px;
  background-color: white;
  transition:
    transform 140ms cubic-bezier(0.45, 0.05, 0.55, 0.95),
    box-shadow 140ms var(--ease-in-out);
}

:where([data-slot="switch"][data-size="s"]) :where([data-slot="switch-thumb"]) {
  width: calc(var(--space-md) - 2px);
  height: calc(var(--space-md) - 2px);
  border-radius: calc(var(--radius-control) / 2 - 1px);
}

:where([data-slot="switch"][data-size="s"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(var(--space-md) * 0.75));
}

:where([data-slot="switch"][data-size="m"]) :where([data-slot="switch-thumb"]) {
  width: calc(var(--space-lg) * 5 / 6 - 2px);
  height: calc(var(--space-lg) * 5 / 6 - 2px);
  border-radius: calc(var(--radius-control) - 1px);
}

:where([data-slot="switch"][data-size="m"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(var(--space-lg) * 5 / 6 * 0.75));
}

:where([data-slot="switch"][data-size="l"]) :where([data-slot="switch-thumb"]) {
  width: calc(var(--space-lg) - 2px);
  height: calc(var(--space-lg) - 2px);
  border-radius: calc(var(--radius-control) - 1px);
}

:where([data-slot="switch"][data-size="l"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  transform: translateX(calc(var(--space-lg) * 0.75));
}

/* --- surface --- */
:where([data-slot="switch"][data-variant="surface"])::before {
  background-color: var(--gray-a3);
  background-image: linear-gradient(to right, var(--accent-track) 40%, transparent 60%);
  box-shadow: inset 0 0 0 1px var(--gray-a5);
}

:where([data-slot="switch"][data-variant="surface"]:active)::before {
  background-color: var(--gray-a4);
}

:where([data-slot="switch"][data-variant="surface"][data-state="checked"]:active)::before {
  filter: brightness(0.92) saturate(1.1);
}

html.dark
  :where([data-slot="switch"][data-variant="surface"][data-state="checked"]:active)::before {
  filter: brightness(1.08);
}

:where([data-slot="switch"][data-variant="surface"][data-disabled]) {
  mix-blend-mode: multiply;
}

html.dark :where([data-slot="switch"][data-variant="surface"][data-disabled]) {
  mix-blend-mode: screen;
}

:where([data-slot="switch"][data-variant="surface"][data-disabled])::before {
  background-image: none;
  background-color: var(--gray-a3);
  box-shadow: inset 0 0 0 1px var(--gray-a3);
  filter: none;
}

:where([data-slot="switch"][data-variant="surface"])
  :where([data-slot="switch-thumb"][data-state="unchecked"]) {
  box-shadow:
    0 0 1px 1px var(--black-a2),
    0 1px 1px var(--black-a1),
    0 2px 4px -1px var(--black-a1);
}

:where([data-slot="switch"][data-variant="surface"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  box-shadow:
    0 1px 3px var(--black-a2),
    0 2px 4px -1px var(--black-a1),
    0 0 0 1px var(--black-a1),
    0 0 0 1px var(--accent-a4),
    -1px 0 1px var(--black-a2);
}

:where([data-slot="switch"][data-variant="surface"])
  :where([data-slot="switch-thumb"][data-state="checked"][data-high-contrast]) {
  box-shadow:
    0 1px 3px var(--black-a2),
    0 2px 4px -1px var(--black-a1),
    0 0 0 1px var(--black-a2),
    -1px 0 1px var(--black-a2);
}

:where([data-slot="switch"][data-variant="surface"])
  :where([data-slot="switch-thumb"][data-disabled]) {
  background-color: var(--gray-2);
  box-shadow:
    0 0 0 1px var(--gray-a2),
    0 1px 3px var(--black-a1);
  transition: none;
}

/* --- classic --- */
:where([data-slot="switch"][data-variant="classic"])::before {
  background-color: var(--gray-a4);
  background-image: linear-gradient(to right, var(--accent-track) 40%, transparent 60%);
  box-shadow:
    0 1px 2px var(--black-a1),
    inset 0 0 0 1px var(--gray-a5);
}

:where([data-slot="switch"][data-variant="classic"][data-state="unchecked"]:active)::before {
  background-color: var(--gray-a5);
}

:where([data-slot="switch"][data-variant="classic"][data-state="checked"])::before {
  box-shadow:
    inset 0 0 0 1px var(--gray-a3),
    inset 0 0 0 1px var(--accent-a4),
    inset 0 0 0 1px var(--black-a1),
    inset 0 1.5px 2px 0 var(--black-a2);
}

:where([data-slot="switch"][data-variant="classic"][data-state="checked"]:active)::before {
  filter: brightness(0.92) saturate(1.1);
}

html.dark
  :where([data-slot="switch"][data-variant="classic"][data-state="checked"]:active)::before {
  filter: brightness(1.08);
}

:where([data-slot="switch"][data-variant="classic"][data-disabled]) {
  mix-blend-mode: multiply;
}

html.dark :where([data-slot="switch"][data-variant="classic"][data-disabled]) {
  mix-blend-mode: screen;
}

:where([data-slot="switch"][data-variant="classic"][data-disabled])::before {
  background-image: none;
  background-color: var(--gray-a5);
  box-shadow:
    0 1px 2px var(--black-a1),
    inset 0 0 0 1px var(--gray-a5);
  opacity: 0.5;
  filter: none;
}

:where([data-slot="switch"][data-variant="classic"])
  :where([data-slot="switch-thumb"][data-state="unchecked"]) {
  box-shadow:
    0 1px 3px var(--black-a3),
    0 2px 4px -1px var(--black-a1),
    0 0 0 1px var(--black-a2);
}

:where([data-slot="switch"][data-variant="classic"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  box-shadow:
    0 1px 3px var(--black-a2),
    0 2px 4px -1px var(--black-a1),
    0 0 0 1px var(--black-a1),
    0 0 0 1px var(--accent-a4),
    -1px 0 1px var(--black-a2);
}

:where([data-slot="switch"][data-variant="classic"])
  :where([data-slot="switch-thumb"][data-state="checked"][data-high-contrast]) {
  box-shadow:
    0 1px 3px var(--black-a2),
    0 2px 4px -1px var(--black-a1),
    0 0 0 1px var(--black-a2),
    -1px 0 1px var(--black-a2);
}

:where([data-slot="switch"][data-variant="classic"])
  :where([data-slot="switch-thumb"][data-disabled]) {
  background-color: var(--gray-2);
  box-shadow:
    0 0 0 1px var(--gray-a2),
    0 1px 3px var(--black-a1);
  transition: none;
}

/* --- soft --- */
:where([data-slot="switch"][data-variant="soft"])::before {
  background-color: var(--gray-a3);
  background-image: linear-gradient(to right, var(--accent-a4) 40%, transparent 60%);
}

:where([data-slot="switch"][data-variant="soft"]:active)::before {
  background-color: var(--gray-a4);
}

:where([data-slot="switch"][data-variant="soft"][data-disabled]) {
  mix-blend-mode: multiply;
}

html.dark :where([data-slot="switch"][data-variant="soft"][data-disabled]) {
  mix-blend-mode: screen;
}

:where([data-slot="switch"][data-variant="soft"][data-disabled])::before {
  background-image: none;
  background-color: var(--gray-a4);
  filter: none;
}

:where([data-slot="switch"][data-variant="soft"]) :where([data-slot="switch-thumb"]) {
  filter: saturate(0.45);
}

:where([data-slot="switch"][data-variant="soft"])
  :where([data-slot="switch-thumb"][data-state="unchecked"]) {
  box-shadow:
    0 0 0 1px var(--black-a1),
    0 1px 3px var(--black-a1),
    0 1px 3px var(--black-a1),
    0 2px 4px -1px var(--black-a1);
}

:where([data-slot="switch"][data-variant="soft"])
  :where([data-slot="switch-thumb"][data-state="checked"]) {
  box-shadow:
    0 0 0 1px var(--black-a1),
    0 1px 3px var(--black-a2),
    0 1px 3px var(--accent-a3),
    0 2px 4px -1px var(--accent-a3);
}

:where([data-slot="switch"][data-variant="soft"])
  :where([data-slot="switch-thumb"][data-disabled]) {
  background-color: var(--gray-2);
  box-shadow:
    0 0 0 1px var(--gray-a2),
    0 1px 3px var(--black-a1);
  filter: none;
  transition: none;
}
</style>
