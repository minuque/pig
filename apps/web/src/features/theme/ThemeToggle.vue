<template>
  <button type="button" class="theme-toggle" :aria-label="actionLabel" @click="toggle">
    <span class="theme-icon" aria-hidden="true">
      <Sun :size="16" :data-visible="!isDark" />
      <Moon :size="16" :data-visible="isDark" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { Moon, Sun } from "lucide-vue-next"
import { computed } from "vue"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const { isDark, toggle } = useColorScheme()
const actionLabel = computed(() =>
  isDark.value ? "当前深色模式，点击切换到浅色模式" : "当前浅色模式，点击切换到深色模式",
)
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
.theme-icon {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
}
.theme-icon :deep(svg) {
  grid-area: 1 / 1;
  transition:
    opacity 300ms cubic-bezier(0.2, 0, 0, 1),
    scale 300ms cubic-bezier(0.2, 0, 0, 1),
    filter 300ms cubic-bezier(0.2, 0, 0, 1);
}
.theme-icon :deep(svg[data-visible="false"]) {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}
@media (pointer: coarse) {
  .theme-toggle {
    width: var(--size-control);
    min-height: var(--size-control);
  }
}
@media (prefers-reduced-motion: reduce) {
  .theme-toggle,
  .theme-icon :deep(svg) {
    transition: none;
  }
}
</style>
