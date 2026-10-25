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
      class="slider-track-plate relative grow rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
    >
      <SliderRange
        data-slot="slider-range"
        class="slider-range-plate absolute rounded-full data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
      />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in modelValue"
      :key="key"
      :aria-label="thumbLabel"
      :aria-labelledby="thumbLabelledby"
      data-slot="slider-thumb"
      class="slider-thumb-plate block size-(--size-icon) shrink-0 rounded-full outline-none transition-[scale] duration-(--duration-fast) ease-(--ease-out) active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:ring-1 focus-visible:ring-primary"
    />
  </SliderRoot>
</template>

<script setup lang="ts">
import type { SliderRootEmits, SliderRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, useAttrs } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SliderRange, SliderRoot, SliderThumb, SliderTrack, useForwardPropsEmits } from "reka-ui"

const props = withDefaults(defineProps<SliderRootProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
const emits = defineEmits<SliderRootEmits>()
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SliderRootProps>
// reka 把 aria-* 留在根节点，而 role=slider 在滑块上，无障碍名要自己转过去
const attrs = useAttrs()
const thumbLabel = computed(() => attrs["aria-label"] as string | undefined)
const thumbLabelledby = computed(() => attrs["aria-labelledby"] as string | undefined)
</script>

<style scoped>
.slider-track-plate {
  border: var(--border-width) solid var(--slider-track-border);
  background: var(--slider-track-bg);
  box-shadow: var(--slider-track-shadow);
}

.slider-range-plate {
  border: var(--border-width) solid var(--slider-fill-border);
  background: var(--slider-fill-bg);
  box-shadow: var(--slider-fill-shadow);
}

/* 最小值的 0 长度不会画出端头边框，避免轨道起点残留 2px 填充 */
.slider-track-plate[data-orientation="horizontal"] .slider-range-plate {
  border-inline-width: 0;
}

.slider-track-plate[data-orientation="vertical"] .slider-range-plate {
  border-block-width: 0;
}

.slider-thumb-plate {
  border: var(--border-width) solid var(--slider-thumb-border);
  background: var(--slider-thumb-bg);
  box-shadow: var(--slider-thumb-shadow);
}
</style>
