<template>
  <div
    v-bind="passAttrs"
    data-slot="slider-field"
    :data-size="size"
    :data-tone="color"
    :data-disabled="disabled ? '' : undefined"
    :class="props.class"
  >
    <span v-if="label" :id="labelId" data-slot="slider-label">{{ label }}</span>

    <div data-slot="slider-shell">
      <SliderRoot
        v-slot="{ modelValue }"
        v-bind="forwarded"
        data-slot="slider"
        thumb-alignment="contain"
        orientation="horizontal"
      >
        <SliderTrack data-slot="slider-track">
          <SliderRange data-slot="slider-range" />
        </SliderTrack>

        <SliderThumb
          v-for="(value, index) in modelValue ?? []"
          :key="index"
          data-slot="slider-thumb"
          :data-edge="edgeOf(value)"
          :aria-label="thumbAriaLabel(index, modelValue?.length ?? 0)"
          :aria-labelledby="thumbLabelledby"
          :aria-valuetext="getAriaValueText?.(value)"
        >
          <span data-slot="slider-grip" aria-hidden="true" />

          <span v-if="showValueBadge" data-slot="slider-badge" aria-hidden="true">
            {{ format(value) }}
          </span>
        </SliderThumb>
      </SliderRoot>
    </div>

    <div v-if="showBounds" data-slot="slider-bounds" aria-hidden="true">
      <span>{{ format(rangeMin) }}</span>
      <span>{{ format(rangeMax) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, useAttrs, useId } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from "reka-ui"
import type { Size, ToneColor } from "@/types/ui-type.js"

defineOptions({ inheritAttrs: false })

interface SliderProps extends SliderRootProps {
  class?: HTMLAttributes["class"]
  size?: Size
  color?: ToneColor
  label?: string
  formatValue?: (value: number) => string
  getAriaLabel?: (index: number) => string
  getAriaValueText?: (value: number) => string
  showValueBadge?: boolean
  showBounds?: boolean
}

const props = withDefaults(defineProps<SliderProps>(), {
  class: undefined,
  size: "m",
  showValueBadge: true,
  showBounds: true,
})
const emits = defineEmits<SliderRootEmits>()
const delegatedProps = reactiveOmit(
  props,
  "class",
  "size",
  "color",
  "label",
  "formatValue",
  "getAriaLabel",
  "getAriaValueText",
  "showValueBadge",
  "showBounds",
)
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SliderRootProps>
const attrs = useAttrs()
const labelId = useId()
const rangeMin = computed(() => props.min ?? 0)
const rangeMax = computed(() => props.max ?? 100)
const thumbLabelledby = computed(
  () => (attrs["aria-labelledby"] as string | undefined) ?? (props.label ? labelId : undefined),
)
const passAttrs = computed(() => {
  const rest = { ...attrs }
  delete rest["aria-label"]
  delete rest["aria-labelledby"]
  return rest
})

function format(value: number) {
  return props.formatValue?.(value) ?? String(value)
}

function edgeOf(value: number) {
  if (value <= rangeMin.value) return "start"

  if (value >= rangeMax.value) return "end"
  return undefined
}

function thumbAriaLabel(index: number, total: number) {
  if (props.getAriaLabel) return props.getAriaLabel(index)
  return total > 1 ? undefined : (attrs["aria-label"] as string | undefined)
}
</script>

<style>
:where([data-slot="slider-field"]) {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  inline-size: 100%;
  font-size: var(--text-body);
}

:where([data-slot="slider-field"][data-size="s"]) {
  font-size: var(--text-meta);
}

:where([data-slot="slider-field"][data-disabled]) {
  opacity: var(--opacity-disabled);
}

:where([data-slot="slider-label"]) {
  color: var(--fg);
  font-weight: var(--font-weight-medium);
}

:where([data-slot="slider-shell"]) {
  padding: 3px;
  border-radius: var(--radius-card);
  background: var(--slider-track-bg);
  box-shadow: var(--slider-track-ring);
  block-size: var(--control-md);
}

:where([data-slot="slider-field"][data-size="s"]) :where([data-slot="slider-shell"]) {
  border-radius: var(--radius-control);
  block-size: 24px;
}

:where([data-slot="slider-field"][data-size="l"]) :where([data-slot="slider-shell"]) {
  block-size: var(--control-lg);
}

:where([data-slot="slider"]) {
  position: relative;
  display: flex;
  align-items: center;
  block-size: 100%;
  inline-size: 100%;
  user-select: none;
  touch-action: none;
}

:where([data-slot="slider-track"]) {
  position: relative;
  flex-grow: 1;
  block-size: 100%;
  margin-inline: 8px;
}

:where([data-slot="slider-range"]) {
  position: absolute;
  inset-block: 0;
  margin-inline: -8px;
  background: var(--slider-range-bg);
  box-shadow: var(--slider-range-shadow);
}

:where([data-slot="slider-field"][data-tone]) :where([data-slot="slider-range"]) {
  background: var(--tone);
}

:where([data-slot="slider-thumb"]) {
  display: block;
  inset-block-start: 0;
  outline: 0;
  cursor: grab;
  inline-size: 16px;
  block-size: 100%;
}

:where([data-slot="slider-range"]),
:where([data-slot="slider-thumb"]) {
  border-radius: calc(var(--radius-card) - 3px);
}

:where([data-slot="slider-field"][data-size="s"]) :where([data-slot="slider-range"]),
:where([data-slot="slider-field"][data-size="s"]) :where([data-slot="slider-thumb"]) {
  border-radius: calc(var(--radius-control) - 3px);
}

:where([data-slot="slider-thumb"]:active) {
  cursor: grabbing;
}

:where([data-slot="slider-thumb"]:focus-visible) {
  box-shadow: var(--focus-ring);
}

:where([data-slot="slider-thumb"][data-disabled]) {
  cursor: not-allowed;
}

:where([data-slot="slider-grip"]) {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  border-radius: var(--radius-pill);
  background: var(--slider-grip);
  transform: translate(-50%, -50%);
  pointer-events: none;
  inline-size: 2px;
  block-size: 50%;
}

:where([data-slot="slider-badge"]) {
  position: absolute;
  inset-block-start: 100%;
  inset-inline-start: 50%;
  z-index: var(--z-sticky);
  margin-block-start: 11px;
  padding: 1px 6px;
  border-radius: calc(var(--radius-control) - 2px);
  background: var(--slider-badge-bg);
  color: var(--slider-badge-fg);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}

:where([data-slot="slider-thumb"][data-edge="start"]) :where([data-slot="slider-badge"]) {
  inset-inline-start: 0;
  transform: none;
}

:where([data-slot="slider-thumb"][data-edge="end"]) :where([data-slot="slider-badge"]) {
  inset-inline: auto 0;
  transform: none;
}

:where([data-slot="slider-bounds"]) {
  display: flex;
  justify-content: space-between;
  padding-inline: 3px;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}
</style>
