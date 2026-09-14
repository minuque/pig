<template>
  <button type="button" class="theme-toggle press-scale" @click="toggle">
    <span class="theme-icon icon-swap">
      <Sun class="size-icon" :data-visible="!isDark" />
      <Moon class="size-icon" :data-visible="isDark" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const { isDark, toggle } = useColorScheme()
</script>

<style scoped>
.theme-toggle {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon-button);
  min-height: var(--size-icon-button);
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
  background: var(--hover-quiet);
  color: var(--ink);
}

.theme-icon {
  width: var(--size-icon);
  height: var(--size-icon);
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
