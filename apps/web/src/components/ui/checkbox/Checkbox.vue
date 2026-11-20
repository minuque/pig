<template>
  <CheckboxRoot
    v-slot="{ modelValue }"
    data-slot="checkbox"
    v-bind="forwarded"
    :data-accent-color="color"
    :data-size="size"
    :data-variant="variant"
    :data-high-contrast="highContrast || undefined"
    :class="props.class"
  >
    <CheckboxIndicator data-slot="checkbox-indicator">
      <MinusIcon v-if="modelValue === 'indeterminate'" data-slot="checkbox-icon" />
      <CheckIcon v-else data-slot="checkbox-icon" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from "reka-ui"
import { CheckIcon, MinusIcon } from "@components/icons/index.js"
import type { Size } from "@components/ui/rt/size.js"

const props = withDefaults(
  defineProps<
    CheckboxRootProps<boolean> & {
      class?: HTMLAttributes["class"] | undefined
      size?: Size | undefined
      variant?: "classic" | "surface" | "soft" | undefined
      color?: string | undefined
      highContrast?: boolean | undefined
    }
  >(),
  { class: undefined, size: "m", variant: "surface", color: undefined, highContrast: false },
)
const emits = defineEmits<CheckboxRootEmits<boolean>>()
const delegatedProps = reactiveOmit(props, "class", "size", "variant", "color", "highContrast")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<
  CheckboxRootProps<boolean>
>
</script>

<style>
:where([data-slot="checkbox"]) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: top;
  appearance: none;
  height: var(--space-md);
  width: var(--space-md);
  cursor: pointer;
}

:where([data-slot="checkbox"][data-size="s"]) {
  height: calc(var(--space-md) * 0.875);
  width: calc(var(--space-md) * 0.875);
}

:where([data-slot="checkbox"][data-size="l"]) {
  height: calc(var(--space-md) * 1.25);
  width: calc(var(--space-md) * 1.25);
}

:where([data-slot="checkbox"])::before {
  content: "";
  display: block;
  height: 100%;
  width: 100%;
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-slot="checkbox"][data-size="s"])::before {
  border-radius: calc(var(--radius-control) / 2 * 0.875);
}

:where([data-slot="checkbox"][data-size="l"])::before {
  border-radius: calc(var(--radius-control) / 2 * 1.25);
}

:where([data-slot="checkbox"]:focus-visible)::before {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="checkbox"][data-disabled]) {
  cursor: default;
}

:where([data-slot="checkbox-indicator"]) {
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 9px;
  height: 9px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

:where([data-slot="checkbox"][data-size="m"]) :where([data-slot="checkbox-indicator"]) {
  width: 10px;
  height: 10px;
}

:where([data-slot="checkbox"][data-size="l"]) :where([data-slot="checkbox-indicator"]) {
  width: 12px;
  height: 12px;
}

:where([data-slot="checkbox-indicator"]) :where(svg) {
  inline-size: 100%;
  block-size: 100%;
  stroke-width: 2.5px;
}

:where([data-slot="checkbox"][data-variant="surface"][data-state="unchecked"])::before {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a7);
}

:where(
  [data-slot="checkbox"][data-variant="surface"]:is(
      [data-state="checked"],
      [data-state="indeterminate"]
    )
)::before {
  background-color: var(--accent-indicator);
}

:where(
    [data-slot="checkbox"][data-variant="surface"]:is(
        [data-state="checked"],
        [data-state="indeterminate"]
      )
  )
  :where([data-slot="checkbox-indicator"]) {
  color: var(--accent-contrast);
}

:where(
  [data-slot="checkbox"][data-variant="surface"]:is(
      [data-state="checked"],
      [data-state="indeterminate"]
    )[data-high-contrast]
)::before {
  background-color: var(--accent-12);
}

:where(
    [data-slot="checkbox"][data-variant="surface"]:is(
        [data-state="checked"],
        [data-state="indeterminate"]
      )[data-high-contrast]
  )
  :where([data-slot="checkbox-indicator"]) {
  color: var(--accent-1);
}

:where([data-slot="checkbox"][data-variant="surface"][data-disabled])::before {
  background-color: transparent;
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a6);
}

:where([data-slot="checkbox"][data-variant="surface"][data-disabled])
  :where([data-slot="checkbox-indicator"]) {
  color: var(--gray-a8);
}

:where([data-slot="checkbox"][data-variant="classic"][data-state="unchecked"])::before {
  background-color: var(--bg-raised);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a3),
    0 1px 2px var(--black-a1);
}

:where(
  [data-slot="checkbox"][data-variant="classic"]:is(
      [data-state="checked"],
      [data-state="indeterminate"]
    )
)::before {
  background-color: var(--accent-indicator);
  background-image: linear-gradient(to bottom, var(--white-a3), transparent, var(--black-a1));
  box-shadow:
    inset 0 0.5px 0.5px var(--white-a4),
    inset 0 -0.5px 0.5px var(--black-a4);
}

:where(
    [data-slot="checkbox"][data-variant="classic"]:is(
        [data-state="checked"],
        [data-state="indeterminate"]
      )
  )
  :where([data-slot="checkbox-indicator"]) {
  color: var(--accent-contrast);
}

:where(
  [data-slot="checkbox"][data-variant="classic"]:is(
      [data-state="checked"],
      [data-state="indeterminate"]
    )[data-high-contrast]
)::before {
  background-color: var(--accent-12);
}

:where(
    [data-slot="checkbox"][data-variant="classic"]:is(
        [data-state="checked"],
        [data-state="indeterminate"]
      )[data-high-contrast]
  )
  :where([data-slot="checkbox-indicator"]) {
  color: var(--accent-1);
}

:where([data-slot="checkbox"][data-variant="classic"][data-disabled])::before {
  background-color: transparent;
  background-image: none;
  box-shadow: 0 1px 2px var(--black-a1);
}

:where([data-slot="checkbox"][data-variant="classic"][data-disabled])
  :where([data-slot="checkbox-indicator"]) {
  color: var(--gray-a8);
}

:where([data-slot="checkbox"][data-variant="soft"])::before {
  background-color: var(--accent-a5);
}

:where(
    [data-slot="checkbox"][data-variant="soft"]:is(
        [data-state="checked"],
        [data-state="indeterminate"]
      )
  )
  :where([data-slot="checkbox-indicator"]) {
  color: var(--accent-a11);
}

:where(
    [data-slot="checkbox"][data-variant="soft"]:is(
        [data-state="checked"],
        [data-state="indeterminate"]
      )[data-high-contrast]
  )
  :where([data-slot="checkbox-indicator"]) {
  color: var(--accent-12);
}

:where([data-slot="checkbox"][data-variant="soft"][data-disabled])::before {
  background-color: transparent;
}

:where([data-slot="checkbox"][data-variant="soft"][data-disabled])
  :where([data-slot="checkbox-indicator"]) {
  color: var(--gray-a8);
}
</style>
