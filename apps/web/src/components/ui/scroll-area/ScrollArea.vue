<template>
  <ScrollAreaRoot
    data-slot="scroll-area"
    v-bind="forwarded"
    :data-scrollbars="scrollbars"
    :data-size="size"
    :class="props.class"
  >
    <ScrollAreaViewport ref="viewportRef" data-slot="scroll-area-viewport">
      <slot />
    </ScrollAreaViewport>

    <div data-slot="scroll-area-focus-ring" />

    <ScrollAreaScrollbar
      v-if="scrollbars !== 'vertical'"
      orientation="horizontal"
      data-slot="scroll-area-scrollbar"
      :data-size="size"
      :data-radius="radius"
    >
      <ScrollAreaThumb data-slot="scroll-area-thumb" />
    </ScrollAreaScrollbar>

    <ScrollAreaScrollbar
      v-if="scrollbars !== 'horizontal'"
      orientation="vertical"
      data-slot="scroll-area-scrollbar"
      :data-size="size"
      :data-radius="radius"
    >
      <ScrollAreaThumb data-slot="scroll-area-thumb" />
    </ScrollAreaScrollbar>

    <ScrollAreaCorner v-if="scrollbars === 'both'" data-slot="scroll-area-corner" />
  </ScrollAreaRoot>
</template>

<script setup lang="ts">
import type { ScrollAreaRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, useTemplateRef } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
  useForwardProps,
} from "reka-ui"
import type { Radius } from "@components/ui/button/index.js"
import type { Size } from "@components/ui/rt/size.js"

const props = withDefaults(
  defineProps<
    ScrollAreaRootProps & {
      scrollbars?: "vertical" | "horizontal" | "both" | undefined
      size?: Size | undefined
      radius?: Radius | undefined
      class?: HTMLAttributes["class"] | undefined
    }
  >(),
  {
    type: "hover",
    scrollHideDelay: 400,
    scrollbars: "both",
    size: "s",
    radius: "full",
    class: undefined,
  },
)
const delegatedProps = reactiveOmit(props, "scrollbars", "size", "radius", "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<ScrollAreaRootProps>
const viewportRef = useTemplateRef<{ viewportElement?: HTMLElement }>("viewportRef")
const viewport = computed(() => viewportRef.value?.viewportElement ?? null)

defineExpose({ viewport })
</script>

<style>
:where([data-slot="scroll-area"]) {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

:where([data-slot="scroll-area-viewport"]) {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

:where([data-slot="scroll-area"][data-scrollbars="vertical"] [data-slot="scroll-area-viewport"]) {
  flex: 1;
  min-block-size: 0;
  max-block-size: inherit;
  overscroll-behavior-y: contain;
}

:where([data-slot="scroll-area-viewport"]:focus-visible)
  + :where([data-slot="scroll-area-focus-ring"]) {
  position: absolute;
  inset: 0;
  pointer-events: none;
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

:where(
  [data-slot="scroll-area-viewport"]:has(
    [data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]
  )
) {
  overscroll-behavior-x: contain;
}

:where([data-slot="scroll-area-viewport"]) > * {
  display: block;
  width: fit-content;
  flex-grow: 1;
}

:where([data-slot="scroll-area"][data-scrollbars="vertical"] [data-slot="scroll-area-viewport"])
  > * {
  width: 100%;
}

:where([data-slot="scroll-area-scrollbar"]) {
  display: flex;
  user-select: none;
  touch-action: none;
  background-color: transparent;
  padding: 2px;
  border-radius: var(--radius-pill);
  animation-duration: 120ms;
  animation-timing-function: ease-out;
}

:where([data-slot="scroll-area-scrollbar"][data-radius="none"]) {
  border-radius: 0;
}

:where(
  [data-slot="scroll-area-scrollbar"]:is(
    [data-radius="small"],
    [data-radius="medium"],
    [data-radius="large"]
  )
) {
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="vertical"]) {
  flex-direction: column;
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]) {
  flex-direction: row;
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="vertical"][data-size="s"]) {
  width: calc(var(--space-2xs) + 4px);
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="vertical"][data-size="m"]) {
  width: calc(var(--space-xs) + 4px);
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="vertical"][data-size="l"]) {
  width: calc(var(--space-sm) + 4px);
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="horizontal"][data-size="s"]) {
  height: calc(var(--space-2xs) + 4px);
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="horizontal"][data-size="m"]) {
  height: calc(var(--space-xs) + 4px);
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="horizontal"][data-size="l"]) {
  height: calc(var(--space-sm) + 4px);
}

:where([data-slot="scroll-area-scrollbar"][data-state="visible"]) {
  animation-name: scroll-area-fade-in;
}

:where([data-slot="scroll-area-scrollbar"][data-state="hidden"]) {
  animation-name: scroll-area-fade-out;
}

:where([data-slot="scroll-area-thumb"]) {
  position: relative;
  flex: 1;
  background-color: var(--scrollbar-color);
  border-radius: inherit;
  transition: background-color 100ms;
}

:where([data-slot="scroll-area-thumb"])::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  min-width: var(--space-md);
  min-height: var(--space-md);
}

@media (hover: hover) {
  :where([data-slot="scroll-area-thumb"]:hover) {
    background-color: var(--gray-a8);
  }
}
</style>
