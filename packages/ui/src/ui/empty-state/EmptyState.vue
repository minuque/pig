<template>
  <div
    data-slot="empty-state"
    :data-size="size"
    :role="live ? 'status' : undefined"
    :class="props.class"
  >
    <div v-if="$slots.art" data-slot="empty-state-art" aria-hidden="true">
      <slot name="art" />
    </div>

    <p v-if="title" data-slot="empty-state-title">{{ title }}</p>

    <p v-if="description && size === 'page'" data-slot="empty-state-description">
      {{ description }}
    </p>

    <div v-if="$slots.actions" data-slot="empty-state-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { EmptyStateSize } from "./index.js"

const props = withDefaults(
  defineProps<{
    title?: string | undefined
    description?: string | undefined
    size?: EmptyStateSize
    live?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  {
    title: undefined,
    description: undefined,
    size: "page",
    live: false,
    class: undefined,
  },
)
</script>

<style>
:where([data-slot="empty-state"]) {
  box-sizing: border-box;
  animation: empty-state-enter var(--duration-slow) var(--ease-out) both;
}

:where([data-slot="empty-state"][data-size="page"]) {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-block-size: 0;
  padding: var(--space-lg);
  text-align: center;
}

:where([data-slot="empty-state"][data-size="page"])::before {
  content: "";
  flex: 2 1 0;
}

:where([data-slot="empty-state"][data-size="page"])::after {
  content: "";
  flex: 3 1 0;
}

:where([data-slot="empty-state"][data-size="page"] [data-slot="empty-state-art"]) {
  display: flex;
  justify-content: center;
  margin-block-end: var(--space-md);
  color: var(--empty-art);
}

:where([data-slot="empty-state"][data-size="page"] [data-slot="empty-state-title"]) {
  max-inline-size: 28rem;
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
  color: var(--fg);
  text-wrap: balance;
}

:where([data-slot="empty-state-description"]) {
  max-inline-size: 28rem;
  margin-block-start: var(--space-2xs);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--fg-muted);
  text-wrap: pretty;
}

:where([data-slot="empty-state"][data-size="page"] [data-slot="empty-state-actions"]) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-xs);
  margin-block-start: var(--space-md);
}

:where([data-slot="empty-state"][data-size="row"]) {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--control-sm);
}

:where([data-slot="empty-state"][data-size="row"] [data-slot="empty-state-title"]) {
  flex: 1;
  min-inline-size: 0;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--fg-muted);
}

:where([data-slot="empty-state"][data-size="row"] [data-slot="empty-state-actions"]) {
  display: flex;
  flex: none;
  gap: var(--space-2xs);
}
</style>
