<template>
  <button type="button" class="theme-toggle" :aria-label="actionLabel" @click="toggle">
    <component :is="isDark ? Moon : Sun" :size="16" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { Moon, Sun } from "lucide-vue-next";
import { computed } from "vue";
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js";

const { isDark, toggle } = useColorScheme();
const actionLabel = computed(() =>
  isDark.value ? "当前深色模式，点击切换到浅色模式" : "当前浅色模式，点击切换到深色模式",
);
</script>

<style scoped>
.theme-toggle {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-muted);
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}
.theme-toggle:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink);
}
@media (pointer: coarse) {
  .theme-toggle {
    width: var(--size-control);
    min-height: var(--size-control);
  }
}
@media (prefers-reduced-motion: reduce) {
  .theme-toggle {
    transition: none;
  }
}
</style>
