<template>
  <SliderRoot
    v-slot="{ modelValue }"
    data-slot="slider"
    v-bind="forwarded"
    class="relative flex w-full touch-none items-center select-none data-[disabled]:opacity-(--opacity-disabled) data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col"
    :class="props.class"
  >
    <SliderTrack
      data-slot="slider-track"
      class="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
    >
      <SliderRange
        data-slot="slider-range"
        class="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
      />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      data-slot="slider-thumb"
      class="block size-(--size-icon) shrink-0 rounded-full border border-border bg-surface shadow-soft outline-none transition-[scale] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:ring-1 focus-visible:ring-primary"
    />
  </SliderRoot>
</template>

<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from "reka-ui"

const props = withDefaults(defineProps<SliderRootProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})

const emits = defineEmits<SliderRootEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SliderRootProps>
</script>
