<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-surface text-ink z-(--z-drawer) max-h-(--reka-dropdown-menu-content-available-height) min-w-(--size-menu) origin-(--reka-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-(--radius-md) border border-hairline p-(--spacing-xxs) shadow-elevated data-[state=open]:animate-[enter-blur_180ms_var(--ease-smooth)]',
          props.class,
        )
      "
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from "reka-ui";
import type { ComputedRef, HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@utils/utils.js";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<DropdownMenuContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    class: undefined,
    sideOffset: 4,
  },
);
const emits = defineEmits<DropdownMenuContentEmits>();

const delegatedProps = reactiveOmit(props, "class");

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<DropdownMenuContentProps>;
</script>
