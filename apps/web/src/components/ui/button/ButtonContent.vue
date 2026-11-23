<template>
  <template v-if="loading">
    <span data-slot="button-label" aria-hidden="true"><slot /></span>
    <span class="sr-only"><slot /></span>
    <span data-slot="button-spinner"><Spinner :size="spinnerSize" /></span>
  </template>

  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Spinner } from "@components/ui/spinner/index.js"
import type { Size } from "@/types/ui-type.js"

const props = withDefaults(defineProps<{ loading?: boolean; size?: Size }>(), {
  loading: false,
  size: "m",
})
const spinnerSize = computed<Size>(() => (props.size === "s" ? "s" : "m"))
</script>

<style>
:where([data-slot="button-label"]) {
  display: contents;
  visibility: hidden;
}

:where([data-slot="button-spinner"]) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
