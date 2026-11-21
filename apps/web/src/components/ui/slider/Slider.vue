<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    v-bind="forwarded"
    :data-tone="color"
    :data-size="size"
    :data-variant="variant"
    :data-radius="radius"
    :class="props.class"
  >
    <SliderTrack data-slot="slider-track">
      <SliderRange data-slot="slider-range" />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      :aria-label="thumbLabel"
      :aria-labelledby="thumbLabelledby"
      data-slot="slider-thumb"
    />
  </SliderRoot>
</template>

<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, useAttrs } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from "reka-ui"
import type { Size, ToneColor } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<
    SliderRootProps & {
      class?: HTMLAttributes["class"]
      size?: Size
      variant?: "surface" | "soft"
      color?: ToneColor
      radius?: "none" | "small" | "medium" | "large" | "full"
    }
  >(),
  { class: undefined, size: "m", variant: "surface" },
)
const emits = defineEmits<SliderRootEmits>()
const delegatedProps = reactiveOmit(props, "class", "size", "variant", "color", "radius")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SliderRootProps>
// 外部：reka 把 aria-* 留在根节点，而 role=slider 在滑块上，无障碍名要自己转过去
const attrs = useAttrs()
const thumbLabel = computed(() => attrs["aria-label"] as string | undefined)
const thumbLabelledby = computed(() => attrs["aria-labelledby"] as string | undefined)
</script>

<style>
:where([data-slot="slider"]) {
  position: relative;
  display: flex;
  align-items: center;
  flex-grow: 1;
  border-radius: var(--radius-pill);
  user-select: none;
  touch-action: none;
}

:where([data-slot="slider"][data-orientation="horizontal"]) {
  inline-size: 100%;
  block-size: var(--space-xs);
}

:where([data-slot="slider"][data-orientation="vertical"]) {
  flex-direction: column;
  inline-size: var(--space-xs);
  block-size: 100%;
}

:where([data-slot="slider-track"]) {
  position: relative;
  flex-grow: 1;
  overflow: hidden;
  border-radius: inherit;
}

:where([data-slot="slider"][data-orientation="horizontal"]) :where([data-slot="slider-track"]) {
  block-size: var(--space-xs);
}

:where([data-slot="slider"][data-orientation="vertical"]) :where([data-slot="slider-track"]) {
  inline-size: var(--space-xs);
}

:where([data-slot="slider"][data-size="s"][data-orientation="horizontal"]),
:where([data-slot="slider"][data-size="s"][data-orientation="horizontal"])
  :where([data-slot="slider-track"]) {
  block-size: calc(var(--space-xs) * 0.75);
}

:where([data-slot="slider"][data-size="s"][data-orientation="vertical"]),
:where([data-slot="slider"][data-size="s"][data-orientation="vertical"])
  :where([data-slot="slider-track"]) {
  inline-size: calc(var(--space-xs) * 0.75);
}

:where([data-slot="slider"][data-size="l"][data-orientation="horizontal"]),
:where([data-slot="slider"][data-size="l"][data-orientation="horizontal"])
  :where([data-slot="slider-track"]) {
  block-size: calc(var(--space-xs) * 1.25);
}

:where([data-slot="slider"][data-size="l"][data-orientation="vertical"]),
:where([data-slot="slider"][data-size="l"][data-orientation="vertical"])
  :where([data-slot="slider-track"]) {
  inline-size: calc(var(--space-xs) * 1.25);
}

:where([data-slot="slider-range"]) {
  position: absolute;
  border-radius: inherit;
}

:where([data-slot="slider"][data-orientation="horizontal"]) :where([data-slot="slider-range"]) {
  block-size: 100%;
}

:where([data-slot="slider"][data-orientation="vertical"]) :where([data-slot="slider-range"]) {
  inline-size: 100%;
}

:where([data-slot="slider-thumb"]) {
  position: relative;
  display: block;
  inline-size: calc(var(--space-xs) + var(--space-2xs));
  block-size: calc(var(--space-xs) + var(--space-2xs));
  outline: 0;
}

:where([data-slot="slider"][data-size="s"]) :where([data-slot="slider-thumb"]) {
  inline-size: calc(var(--space-xs) * 0.75 + var(--space-2xs));
  block-size: calc(var(--space-xs) * 0.75 + var(--space-2xs));
}

:where([data-slot="slider"][data-size="l"]) :where([data-slot="slider-thumb"]) {
  inline-size: calc(var(--space-xs) * 1.25 + var(--space-2xs));
  block-size: calc(var(--space-xs) * 1.25 + var(--space-2xs));
}

:where([data-slot="slider-thumb"])::before {
  content: "";
  position: absolute;
  z-index: var(--z-behind);
  top: 50%;
  left: 50%;
  inline-size: 300%;
  block-size: 300%;
  transform: translate(-50%, -50%);
}

:where([data-slot="slider-thumb"])::after {
  content: "";
  position: absolute;
  inset: calc(var(--space-xs) * -0.25);
  background-color: var(--fg-on-accent);
  border-radius: var(--radius-pill);
  cursor: pointer;
}

:where([data-slot="slider"][data-size="s"]) :where([data-slot="slider-thumb"])::after {
  inset: calc(var(--space-xs) * 0.75 * -0.25);
}

:where([data-slot="slider"][data-size="l"]) :where([data-slot="slider-thumb"])::after {
  inset: calc(var(--space-xs) * 1.25 * -0.25);
}

:where([data-slot="slider-thumb"][data-disabled]) {
  cursor: default;
}

:where([data-slot="slider-thumb"][data-disabled])::after {
  cursor: default;
}

:where([data-slot="slider"][data-variant="surface"]) :where([data-slot="slider-track"]) {
  background-color: var(--bg-muted);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

:where([data-slot="slider"][data-variant="surface"])
  :where([data-slot="slider-track"][data-disabled]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

:where([data-slot="slider"][data-variant="surface"]) :where([data-slot="slider-range"]) {
  background-color: var(--tone);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

:where([data-slot="slider"][data-variant="surface"]) :where([data-slot="slider-thumb"])::after {
  box-shadow: 0 0 0 1px var(--thumb-ring);
}

:where([data-slot="slider"][data-variant="surface"])
  :where([data-slot="slider-thumb"][data-disabled])::after {
  background-color: var(--bg);
  box-shadow: 0 0 0 1px var(--border-strong);
}

:where([data-slot="slider"][data-variant="soft"]) :where([data-slot="slider-track"]) {
  background-color: var(--bg-hover);
}

:where([data-slot="slider"][data-variant="soft"])
  :where([data-slot="slider-track"][data-disabled]) {
  background-color: var(--bg-hover);
  background-image: none;
}

:where([data-slot="slider"][data-variant="soft"]) :where([data-slot="slider-range"]) {
  background-color: var(--tone-border);
}

:where([data-slot="slider"][data-variant="soft"]) :where([data-slot="slider-thumb"])::after {
  box-shadow:
    0 0 0 1px var(--thumb-ring),
    0 0 0 1px var(--border-subtle),
    0 0 0 1px var(--tone-subtle),
    0 1px 2px var(--border),
    0 1px 3px -0.5px var(--border-subtle);
}

:where([data-slot="slider"][data-variant="soft"])
  :where([data-slot="slider-thumb"][data-disabled])::after {
  background-color: var(--bg);
  box-shadow: 0 0 0 1px var(--border-strong);
}

:where([data-slot="slider-thumb"]:focus-visible)::after {
  outline: none;
  box-shadow:
    0 0 0 1px var(--thumb-ring),
    0 0 0 3px var(--tone-subtle),
    0 0 0 5px var(--focus-color);
}

:where([data-slot="slider"][data-disabled]) {
  cursor: default;
  mix-blend-mode: multiply;
}

html.dark :where([data-slot="slider"][data-disabled]) {
  mix-blend-mode: screen;
}

:where([data-slot="slider"][data-disabled]) :where([data-slot="slider-range"]) {
  background-color: transparent;
  background-image: none;
  box-shadow: none;
}
</style>
