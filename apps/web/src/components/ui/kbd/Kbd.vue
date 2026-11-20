<template>
  <Primitive
    data-slot="kbd"
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
      size?: Size
      variant?: "surface" | "soft"
    }
  >(),
  { as: "kbd", asChild: false, size: "m", variant: "surface", class: undefined },
)
</script>

<style>
:where([data-slot="kbd"]) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  height: fit-content;
  position: relative;
  top: -0.03em;
  min-width: 1.75em;
  padding-left: 0.5em;
  padding-right: 0.5em;
  padding-bottom: 0.05em;
  border: 0;
  border-radius: calc(var(--radius-control) * 0.7);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-normal);
  font-size: 0.75em;
  line-height: 1.7em;
  vertical-align: text-top;
  white-space: nowrap;
  word-spacing: -0.1em;
  user-select: none;
  color: var(--fg);
}

:where([data-slot="kbd"][data-size="s"]) {
  font-size: calc(var(--text-meta) * 0.8);
}

:where([data-slot="kbd"][data-size="m"]) {
  font-size: calc(var(--text-body) * 0.8);
}

:where([data-slot="kbd"][data-size="l"]) {
  font-size: calc(var(--text-title) * 0.8);
}

:where([data-slot="kbd"][data-variant="surface"]) {
  background-color: var(--bg-raised);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--border-strong),
    inset 0 -1px 0 var(--border-strong);
  transition:
    box-shadow var(--duration-fast),
    background-color var(--duration-fast);
}

:where([data-slot="kbd"][data-variant="surface"]:is(:any-link, button):is([data-state="open"])) {
  background-color: var(--bg-surface);
}

:where(
  [data-slot="kbd"][data-variant="surface"]:is(:any-link, button):active:not([data-state="open"])
) {
  padding-top: 0.05em;
  padding-bottom: 0;
  background-color: var(--bg-hover);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

:where([data-slot="kbd"][data-variant="soft"]) {
  background-color: var(--gray-a3);
}

:where([data-slot="kbd"][data-variant="soft"]:is(:any-link, button):is([data-state="open"])) {
  background-color: var(--gray-a4);
}

:where(
  [data-slot="kbd"][data-variant="soft"]:is(:any-link, button):active:not([data-state="open"])
) {
  background-color: var(--gray-a5);
}

:where([data-slot="kbd"]:is(:any-link, button):focus-visible) {
  outline: 2px solid var(--focus-color);
}

@media (hover: hover) {
  :where([data-slot="kbd"][data-variant="surface"]:is(:any-link, button):hover) {
    background-color: var(--bg-surface);
  }

  :where([data-slot="kbd"][data-variant="soft"]:is(:any-link, button):hover) {
    background-color: var(--gray-a4);
  }
}
</style>
