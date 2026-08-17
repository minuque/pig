<template>
  <div class="fold">
    <button
      type="button"
      class="fold-toggle"
      :class="toggleClass"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="fold-caret" aria-hidden="true">▸</span>
      <slot name="summary" />
    </button>
    <div v-if="open" class="reveal">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from "vue";

withDefaults(
  defineProps<{
    toggleClass?: string;
  }>(),
  { toggleClass: "" },
);

const open = shallowRef(false);
</script>

<style scoped>
.fold {
  margin-bottom: var(--spacing-xxs);
}
.fold-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 0;
  padding: var(--spacing-xxs) 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  text-align: left;
}
.fold-toggle:hover {
  color: var(--ink);
}
.fold-toggle:not(:disabled):active {
  transform: none;
}
.fold-caret {
  display: inline-block;
  font-size: 10px;
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.fold-toggle[aria-expanded="true"] .fold-caret {
  transform: rotate(90deg);
}
@media (prefers-reduced-motion: reduce) {
  .fold-caret {
    transition: none;
  }
}
</style>
