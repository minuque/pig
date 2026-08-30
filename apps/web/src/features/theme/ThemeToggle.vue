<template>
  <button type="button" class="theme-toggle press-scale" @click="toggle">
    <span class="theme-icon icon-swap">
      <Sun :size="16" :data-visible="!isDark" />
      <Moon :size="16" :data-visible="isDark" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { Moon, Sun } from "lucide-vue-next"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const { isDark, toggle } = useColorScheme()
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
    color var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
}
.theme-toggle:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink);
}
.theme-icon {
  width: 16px;
  height: 16px;
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
