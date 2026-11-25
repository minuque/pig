<template>
  <TabsList :data-variant="variant" :data-size="size" :data-tone="color" :class="props.class">
    <slot />
    <TabsIndicator v-if="variant === 'segmented'" class="segmented-indicator" />
  </TabsList>
</template>

<script setup lang="ts">
import type { ToneColor } from "../../core/types.js"
import type { HTMLAttributes } from "vue"
import { provide, toRef } from "vue"
import { TabsIndicator, TabsList } from "@ui-sdk/vue/tabs"
import { TABS_VARIANT, type TabsVariant } from "./context.js"

const props = withDefaults(
  defineProps<{
    variant?: TabsVariant
    size?: "s" | "m"
    color?: ToneColor | undefined
    class?: HTMLAttributes["class"] | undefined
  }>(),
  { variant: "underline", size: "m", color: undefined, class: undefined },
)

provide(TABS_VARIANT, toRef(props, "variant"))
</script>

<style>
:where([data-slot="tabs-list"][data-variant="underline"]) {
  display: flex;
  justify-content: flex-start;
  overflow-x: auto;
  white-space: nowrap;
  box-shadow: inset 0 -1px 0 0 var(--border-strong);
  font-family: var(--font-sans);
  font-style: normal;
  scrollbar-width: none;
}

:where([data-slot="tabs-list"][data-variant="underline"])::-webkit-scrollbar {
  display: none;
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="s"]) {
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="m"]) {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="tabs-list"][data-variant="underline"]) :where([data-slot="tabs-tab"]) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  padding-inline: var(--space-xs);
  user-select: none;
  color: var(--fg-secondary);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="s"])
  :where([data-slot="tabs-tab"]) {
  height: var(--space-2xl);
  padding-inline: var(--space-2xs);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="m"])
  :where([data-slot="tabs-tab"]) {
  height: var(--control-lg);
}

@media (hover: hover) {
  :where([data-slot="tabs-list"][data-variant="underline"]) :where([data-slot="tabs-tab"]:hover) {
    color: var(--fg);
  }

  :where([data-slot="tabs-list"][data-variant="underline"])
    :where([data-slot="tabs-tab"]:hover)
    :where([data-slot="tabs-trigger-inner"]) {
    background-color: var(--bg-muted);
  }
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-tab"][data-selected]) {
  color: var(--fg);
  font-weight: var(--font-weight-medium);
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-tab"][data-selected])::before {
  content: "";
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  box-sizing: border-box;
  height: 2px;
  background-color: var(--tone);
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-tab"]:focus-visible) {
  outline: none;
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-tab"]:focus-visible)
  :where([data-slot="tabs-trigger-inner"]) {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger-inner"], [data-slot="tabs-trigger-inner-hidden"]) {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

:where([data-slot="tabs-list"][data-variant="underline"]) :where([data-slot="tabs-trigger-inner"]) {
  position: absolute;
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="s"])
  :where([data-slot="tabs-trigger-inner"], [data-slot="tabs-trigger-inner-hidden"]) {
  padding: calc(var(--space-2xs) * 0.5) var(--space-2xs);
  border-radius: var(--radius-min);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="m"])
  :where([data-slot="tabs-trigger-inner"], [data-slot="tabs-trigger-inner-hidden"]) {
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger-inner-hidden"]) {
  visibility: hidden;
  font-weight: var(--font-weight-medium);
}

:where([data-slot="tabs-list"][data-variant="segmented"]) {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  align-self: flex-start;
  block-size: var(--control-md);
  padding-inline: var(--space-2xs);
  border-radius: var(--radius-card);
  background: var(--sidebar);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
  font-size: var(--text-body);
  isolation: isolate;
}

:where([data-slot="tabs-list"][data-variant="segmented"][data-size="s"]) {
  block-size: var(--control-sm);
  border-radius: var(--radius-control);
  font-size: var(--text-meta);
}

:where([data-slot="tabs-list"][data-variant="segmented"]) .segmented-indicator {
  position: absolute;
  z-index: var(--z-behind);
  inset-block: var(--space-2xs);
  inset-inline-start: 0;
  inline-size: var(--active-tab-width);
  border-radius: var(--radius-control);
  background: var(--bg-raised);
  box-shadow: 0 0 0 var(--border-width) var(--border-strong);
  transform: translateX(var(--active-tab-left));
  transition-property: transform, inline-size;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-out);
}

:where([data-slot="tabs-list"][data-variant="segmented"])
  .segmented-indicator[data-activation-direction="none"] {
  transition: none;
}

:where([data-slot="tabs-list"][data-variant="segmented"][data-size="s"]) .segmented-indicator {
  border-radius: var(--radius-min);
}

@media (prefers-reduced-motion: reduce) {
  :where([data-slot="tabs-list"][data-variant="segmented"]) .segmented-indicator {
    transition: none;
  }
}
</style>
