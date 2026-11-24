<template>
  <span
    v-if="loading"
    v-bind="$attrs"
    data-slot="skeleton"
    aria-hidden="true"
    tabindex="-1"
    data-inline-skeleton
    :class="props.class"
    :style="skeletonStyle"
  >
    <slot />
  </span>

  <slot v-else />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    loading?: boolean
    width?: string
    height?: string
    class?: HTMLAttributes["class"]
  }>(),
  { loading: true, class: undefined },
)
const skeletonStyle = computed(() => ({
  inlineSize: props.width,
  blockSize: props.height,
}))
</script>

<style>
:where([data-slot="skeleton"]) {
  border-radius: calc(var(--radius-control) / 2);
  background-color: var(--bg-muted);
  animation: skeleton-pulse 1000ms infinite alternate-reverse;
  background-image: none;
  background-clip: border-box;
  border: 0;
  box-shadow: none;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  color: transparent;
  outline: none;
  pointer-events: none;
  user-select: none;
  cursor: default;
}

:where([data-slot="skeleton"][data-inline-skeleton]) {
  line-height: 0;
}

:where([data-slot="skeleton"]:empty) {
  display: block;
  height: var(--space-sm);
}

:where([data-slot="skeleton"]) > *,
:where([data-slot="skeleton"])::after,
:where([data-slot="skeleton"])::before {
  visibility: hidden;
}
</style>
