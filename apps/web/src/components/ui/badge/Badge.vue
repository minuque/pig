<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import type { BadgeVariants } from "./index.js";
import { reactiveOmit } from "@vueuse/core";
import { Primitive } from "reka-ui";
import { cn } from "@utils/utils.js";
import { badgeVariants } from "./index.js";

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      variant?: BadgeVariants["variant"];
      class?: HTMLAttributes["class"];
    }
  >(),
  {
    as: "span",
    asChild: false,
    variant: "default",
    class: undefined,
  },
);

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <Primitive
    data-slot="badge"
    :class="cn(badgeVariants({ variant }), props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </Primitive>
</template>
