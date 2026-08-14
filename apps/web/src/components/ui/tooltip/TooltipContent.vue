<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui";
import type { ComputedRef, HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@utils/utils.js";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    sideOffset: 4,
  },
);

const emits = defineEmits<TooltipContentEmits>();

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<TooltipContentProps>;
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="
        cn(
          'bg-ink text-surface z-50 w-fit rounded-md px-3 py-1.5 text-xs text-balance data-[state=open]:animate-[enter-blur_120ms_var(--ease-smooth)]',
          props.class,
        )
      "
    >
      <slot />

      <TooltipArrow
        class="bg-ink fill-ink z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-xs"
      />
    </TooltipContent>
  </TooltipPortal>
</template>
