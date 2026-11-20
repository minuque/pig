<template>
  <Primitive
    data-slot="card"
    :data-size="size"
    :data-variant="variant"
    :as="as"
    :as-child="asChild"
    :class="props.class"
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import type { Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      class?: HTMLAttributes["class"]
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "surface" | "ghost"
    }
  >(),
  { as: "div", asChild: false, size: "m", variant: "surface", class: undefined },
)
</script>

<style>
:where([data-slot="card"]) {
  --card-border-radius: var(--radius-card);
  box-sizing: border-box;
  display: block;
  position: relative;
  overflow: hidden;
  padding: var(--card-padding);
  border-radius: var(--card-border-radius);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-normal);
  font-style: normal;
  text-align: start;
  contain: paint;
}

:where([data-slot="card"])::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: inherit;
}

:where([data-slot="card"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-slot="card"][data-size="s"]) {
  --card-padding: var(--space-sm);
}

:where([data-slot="card"][data-size="m"]) {
  --card-padding: var(--space-md);
}

:where([data-slot="card"][data-size="l"]) {
  --card-padding: var(--space-lg);
}

:where([data-slot="card"][data-variant="surface"]) {
  --card-background-color: var(--card-surface);
  background-color: var(--card-background-color);
}

:where([data-slot="card"][data-variant="surface"])::after {
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

@media (hover: hover) {
  :where([data-slot="card"][data-variant="surface"]:is(:any-link, button, label):hover)::after {
    box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
  }
}

:where([data-slot="card"][data-variant="surface"]:is(:any-link, button, label):active)::after {
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

:where([data-slot="card"][data-variant="ghost"]) {
  margin: calc(var(--card-padding) * -1);
}

@media (hover: hover) {
  :where([data-slot="card"][data-variant="ghost"]:is(:any-link, button, label):hover) {
    background-color: var(--gray-a3);
  }

  :where(
    [data-slot="card"][data-variant="ghost"]:is(:any-link, button, label):hover:focus-visible
  ) {
    background-color: var(--accent-a2);
  }
}
</style>
