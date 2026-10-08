<template>
  <SwitchRoot data-slot="switch" v-bind="forwarded" class="switch" :class="props.class">
    <span class="switch-track">
      <span class="switch-mark switch-mark-on" />
      <span class="switch-mark switch-mark-off" />
      <SwitchThumb class="switch-thumb" />
    </span>
  </SwitchRoot>
</template>

<script setup lang="ts">
import "./switch.css"

import type { SwitchRootEmits, SwitchRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from "reka-ui"

const props = withDefaults(
  defineProps<SwitchRootProps<boolean> & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const emits = defineEmits<SwitchRootEmits<boolean>>()
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<
  SwitchRootProps<boolean>
>
</script>
