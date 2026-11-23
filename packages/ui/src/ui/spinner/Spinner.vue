<template>
  <span
    data-slot="spinner"
    :data-size="size"
    :class="props.class"
    role="status"
    :aria-label="label"
  >
    <span v-for="n in 8" :key="n" data-slot="spinner-leaf" />
  </span>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { Size } from "../../core/types.js"

const props = withDefaults(
  defineProps<{
    size?: Size
    label?: string
    class?: HTMLAttributes["class"]
  }>(),
  { size: "m", class: undefined },
)
</script>

<style>
:where([data-slot="spinner"]) {
  display: block;
  position: relative;
  opacity: 0.65;
}

:where([data-slot="spinner"][data-size="s"]) {
  width: var(--space-sm);
  height: var(--space-sm);
}

:where([data-slot="spinner"][data-size="m"]) {
  width: var(--space-md);
  height: var(--space-md);
}

:where([data-slot="spinner"][data-size="l"]) {
  width: calc(1.25 * var(--space-md));
  height: calc(1.25 * var(--space-md));
}

:where([data-slot="spinner-leaf"]) {
  position: absolute;
  top: 0;
  left: calc(50% - 12.5% / 2);
  width: 12.5%;
  height: 100%;
  animation: spinner-leaf-fade 800ms linear infinite;
}

:where([data-slot="spinner-leaf"])::before {
  content: "";
  display: block;
  width: 100%;
  height: 30%;
  border-radius: calc(var(--radius-control) / 2);
  background-color: currentColor;
}

:where([data-slot="spinner-leaf"]:nth-child(1)) {
  transform: rotate(0deg);
  animation-delay: -800ms;
}

:where([data-slot="spinner-leaf"]:nth-child(2)) {
  transform: rotate(45deg);
  animation-delay: -700ms;
}

:where([data-slot="spinner-leaf"]:nth-child(3)) {
  transform: rotate(90deg);
  animation-delay: -600ms;
}

:where([data-slot="spinner-leaf"]:nth-child(4)) {
  transform: rotate(135deg);
  animation-delay: -500ms;
}

:where([data-slot="spinner-leaf"]:nth-child(5)) {
  transform: rotate(180deg);
  animation-delay: -400ms;
}

:where([data-slot="spinner-leaf"]:nth-child(6)) {
  transform: rotate(225deg);
  animation-delay: -300ms;
}

:where([data-slot="spinner-leaf"]:nth-child(7)) {
  transform: rotate(270deg);
  animation-delay: -200ms;
}

:where([data-slot="spinner-leaf"]:nth-child(8)) {
  transform: rotate(315deg);
  animation-delay: -100ms;
}
</style>
