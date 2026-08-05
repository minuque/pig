<template>
  <div class="theme-toggle" role="group" aria-label="主题">
    <button
      v-for="option in options"
      :key="option.mode"
      type="button"
      class="theme-option"
      :class="{ active: mode === option.mode }"
      :aria-pressed="mode === option.mode"
      :aria-label="option.label"
      @click="mode = option.mode"
    >
      <component :is="option.icon" :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from "@vueuse/core";
import { Monitor, Moon, Sun } from "lucide-vue-next";
import type { Component } from "vue";

const mode = useColorMode({ emitAuto: true, storageKey: "npg-theme" });

const options: Array<{
  mode: "light" | "dark" | "auto";
  label: string;
  icon: Component;
}> = [
  { mode: "light", label: "浅色模式", icon: Sun },
  { mode: "dark", label: "深色模式", icon: Moon },
  { mode: "auto", label: "跟随系统", icon: Monitor },
];
</script>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-full);
  background: var(--canvas-soft);
}
.theme-option {
  display: grid;
  place-items: center;
  width: var(--size-control);
  min-height: var(--size-control);
  padding: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-faint);
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.theme-option:hover {
  color: var(--ink);
}
.theme-option.active {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-card);
}
@media (pointer: coarse) {
  .theme-option {
    width: calc(var(--size-control) + var(--spacing-xxs));
    min-height: calc(var(--size-control) + var(--spacing-xxs));
  }
}
@media (prefers-reduced-motion: reduce) {
  .theme-option {
    transition: none;
  }
}
</style>
