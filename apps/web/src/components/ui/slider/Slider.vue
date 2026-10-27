<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    v-bind="forwarded"
    :data-accent-color="color"
    :data-radius="radius"
    class="rt-SliderRoot"
    :class="[sizeClass, variantClass, props.class]"
  >
    <SliderTrack data-slot="slider-track" class="rt-SliderTrack">
      <SliderRange data-slot="slider-range" class="rt-SliderRange" />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      :aria-label="thumbLabel"
      :aria-labelledby="thumbLabelledby"
      data-slot="slider-thumb"
      class="rt-SliderThumb"
    />
  </SliderRoot>
</template>

<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, useAttrs } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from "reka-ui"
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"

const props = withDefaults(
  defineProps<
    SliderRootProps & {
      class?: HTMLAttributes["class"]
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "classic" | "surface" | "soft"
      color?: string
      radius?: "none" | "small" | "medium" | "large" | "full"
    }
  >(),
  { class: undefined, size: "m", variant: "surface" },
)
const emits = defineEmits<SliderRootEmits>()
const delegatedProps = reactiveOmit(props, "class", "size", "variant", "color", "radius")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SliderRootProps>
// reka 把 aria-* 留在根节点，而 role=slider 在滑块上，无障碍名要自己转过去
const attrs = useAttrs()
const thumbLabel = computed(() => attrs["aria-label"] as string | undefined)
const thumbLabelledby = computed(() => attrs["aria-labelledby"] as string | undefined)
const sizeClass = rtSizeClass(props.size)
const variantClass = `rt-variant-${props.variant}`
</script>
