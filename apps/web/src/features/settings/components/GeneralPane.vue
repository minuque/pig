<template>
  <section class="pane">
    <div class="row">
      <div class="copy">
        <h3 class="label">外观</h3>
      </div>
      <div class="scheme" role="radiogroup" aria-label="外观">
        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          class="scheme-btn"
          role="radio"
          :aria-checked="scheme === option.id"
          :title="option.label"
          @click="setScheme(option.id)"
        >
          <component :is="option.icon" class="size-icon" :stroke-width="1.75" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Monitor, Moon, Sun } from "@lucide/vue"
import { useColorScheme, type ColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const { scheme, setScheme } = useColorScheme()

const options: { id: ColorScheme; label: string; icon: typeof Monitor }[] = [
  { id: "auto", label: "系统", icon: Monitor },
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
]
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-height: var(--size-control);
  padding-block: var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--hairline);
}
.label {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-md--line-height);
}
.scheme {
  display: inline-flex;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
}
.scheme-btn {
  display: grid;
  place-items: center;
  width: var(--size-icon-button);
  min-height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
}
.scheme-btn:hover {
  color: var(--ink);
  background: var(--hover-quiet);
}
.scheme-btn[aria-checked="true"] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}
</style>
