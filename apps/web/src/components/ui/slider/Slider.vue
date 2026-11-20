<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    v-bind="forwarded"
    :data-accent-color="color"
    :data-size="size"
    :data-variant="variant"
    :data-radius="radius"
    :class="props.class"
  >
    <SliderTrack data-slot="slider-track">
      <SliderRange data-slot="slider-range" :data-high-contrast="highContrast || undefined" />
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
import type { Size } from "@components/ui/rt/size.js"

const props = withDefaults(
  defineProps<
    SliderRootProps & {
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
const emits = defineEmits<SliderRootEmits>()
const delegatedProps = reactiveOmit(
  props,
  "class",
  "size",
  "variant",
  "color",
  "radius",
  "highContrast",
)
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SliderRootProps>
// reka 把 aria-* 留在根节点，而 role=slider 在滑块上，无障碍名要自己转过去
const attrs = useAttrs()
const thumbLabel = computed(() => attrs["aria-label"] as string | undefined)
const thumbLabelledby = computed(() => attrs["aria-labelledby"] as string | undefined)
</script>

<style>
/* 滑杆：轨道高 6/8/10，滑块比轨道大 4px，圆角取轨道的三分之一 */
:where([data-slot="slider"]) {
  position: relative;
  display: flex;
  align-items: center;
  flex-grow: 1;
  border-radius: calc(var(--space-xs) / 3);
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

:where([data-slot="slider"][data-size="s"]) {
  border-radius: calc(var(--space-xs) * 0.75 / 3);
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

:where([data-slot="slider"][data-size="l"]) {
  border-radius: calc(var(--space-xs) * 1.25 / 3);
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

/* 滑块：可点区域是可见尺寸的三倍，视觉部分画在 ::after 上 */
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
  background-color: white;
  border-radius: calc(var(--radius-control) / 2);
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

/* --- surface --- */
:where([data-slot="slider"][data-variant="surface"]) :where([data-slot="slider-track"]) {
  background-color: var(--gray-a3);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a5);
}

:where([data-slot="slider"][data-variant="surface"])
  :where([data-slot="slider-track"][data-disabled]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a4);
}

:where([data-slot="slider"][data-variant="surface"]) :where([data-slot="slider-range"]) {
  background-color: var(--accent-track);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a5);
}

:where([data-slot="slider"][data-variant="surface"])
  :where([data-slot="slider-range"][data-high-contrast]) {
  background-image: linear-gradient(var(--black-a8), var(--black-a8));
}

html.dark
  :where([data-slot="slider"][data-variant="surface"])
  :where([data-slot="slider-range"][data-high-contrast]) {
  background-image: none;
}

:where([data-slot="slider"][data-variant="surface"]) :where([data-slot="slider-thumb"])::after {
  box-shadow: 0 0 0 1px var(--black-a4);
}

:where([data-slot="slider"][data-variant="surface"])
  :where([data-slot="slider-thumb"][data-disabled])::after {
  background-color: var(--gray-1);
  box-shadow: 0 0 0 1px var(--gray-6);
}

/* --- classic --- */
:where([data-slot="slider"][data-variant="classic"]) :where([data-slot="slider-track"]) {
  position: relative;
  background-color: var(--gray-a3);
}

:where([data-slot="slider"][data-variant="classic"]) :where([data-slot="slider-track"])::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a5),
    0 1px 2px var(--black-a1);
}

:where([data-slot="slider"][data-variant="classic"])
  :where([data-slot="slider-track"][data-disabled])::before {
  opacity: 0.5;
}

:where([data-slot="slider"][data-variant="classic"]) :where([data-slot="slider-range"]) {
  background-color: var(--accent-track);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a3),
    inset 0 0 0 var(--border-width) var(--accent-a4),
    inset 0 0 0 var(--border-width) var(--black-a1),
    inset 0 1.5px 2px 0 var(--black-a2);
}

:where([data-slot="slider"][data-variant="classic"])
  :where([data-slot="slider-range"][data-high-contrast]) {
  background-image: linear-gradient(var(--black-a8), var(--black-a8));
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a3),
    inset 0 0 0 var(--border-width) var(--black-a2),
    inset 0 1.5px 2px 0 var(--black-a2);
}

html.dark
  :where([data-slot="slider"][data-variant="classic"])
  :where([data-slot="slider-range"][data-high-contrast]) {
  background-image: none;
}

:where([data-slot="slider"][data-variant="classic"]) :where([data-slot="slider-thumb"])::after {
  box-shadow:
    0 0 0 1px var(--black-a3),
    0 1px 3px var(--black-a1),
    0 2px 4px -1px var(--black-a1);
}

:where([data-slot="slider"][data-variant="classic"])
  :where([data-slot="slider-thumb"][data-disabled])::after {
  background-color: var(--gray-1);
  box-shadow: 0 0 0 1px var(--gray-6);
}

/* --- soft --- */
:where([data-slot="slider"][data-variant="soft"]) :where([data-slot="slider-track"]) {
  background-color: var(--gray-a4);
  background-image: linear-gradient(var(--white-a1), var(--white-a1));
}

:where([data-slot="slider"][data-variant="soft"])
  :where([data-slot="slider-track"][data-disabled]) {
  background-color: var(--gray-a4);
  background-image: none;
}

:where([data-slot="slider"][data-variant="soft"]) :where([data-slot="slider-range"]) {
  background-color: var(--accent-6);
  background-image: linear-gradient(var(--accent-a5), var(--accent-a5));
}

:where([data-slot="slider"][data-variant="soft"]) :where([data-slot="slider-thumb"])::after {
  box-shadow:
    0 0 0 1px var(--black-a3),
    0 0 0 1px var(--gray-a2),
    0 0 0 1px var(--accent-a2),
    0 1px 2px var(--gray-a4),
    0 1px 3px -0.5px var(--gray-a3);
}

:where([data-slot="slider"][data-variant="soft"])
  :where([data-slot="slider-thumb"][data-disabled])::after {
  background-color: var(--gray-1);
  box-shadow: 0 0 0 1px var(--gray-5);
}

/* 焦点环叠在滑块阴影外：一档浅强调底 + 一档前景焦点环 */
:where([data-slot="slider-thumb"]:focus-visible)::after {
  outline: none;
  box-shadow:
    0 0 0 1px var(--black-a4),
    0 0 0 3px var(--accent-3),
    0 0 0 5px var(--focus-color);
}

/* --- 禁用 --- */
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
