<template>
  <div class="canvas-controls" data-canvas-controls>
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="缩小"
      aria-keyshortcuts="-"
      @click="emit('zoom', 1 / 1.12)"
    >
      <MinimizeSquareIcon />
    </Button>

    <span class="canvas-zoom" aria-live="polite">{{ label }}</span>

    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="放大"
      aria-keyshortcuts="+"
      @click="emit('zoom', 1.12)"
    >
      <MaximizeSquareIcon />
    </Button>

    <Button type="button" variant="outline" @click="emit('fit')">适应全部</Button>
    <Button type="button" variant="outline" @click="emit('reset')">重置镜头</Button>

    <label class="canvas-theme">
      <span>主题</span>

      <select :value="selected" aria-label="主题" @change="onTheme">
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { MaximizeSquareIcon, MinimizeSquareIcon } from "@components/icons/index.js"
import { Button } from "@components/ui/button/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { DEFAULT_THEME_ID, THEMES } from "@features/theme/lib/palette.js"

const emit = defineEmits<{ zoom: [factor: number]; fit: []; reset: [] }>()
const { isDark, scheme, themeId, setScheme, setTheme } = useColorScheme()
const label = shallowRef("100%")
const options = THEMES.flatMap((theme) => [
  { value: `light:${theme.id}`, label: `浅色 · ${theme.label}` },
  { value: `dark:${theme.id}`, label: `深色 · ${theme.label}` },
])
const selected = computed(() => {
  const mode = scheme.value === "auto" ? (isDark.value ? "dark" : "light") : scheme.value
  return `${mode}:${themeId.value ?? DEFAULT_THEME_ID}`
})

function setZoomLabel(zoom: number) {
  label.value = `${Math.round(zoom * 100)}%`
}

function onTheme(event: Event) {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : ""
  const [mode, id] = value.split(":")

  if (mode !== "light" && mode !== "dark") return
  const next = THEMES.find((theme) => theme.id === id)

  if (!next) return
  setScheme(mode)
  setTheme(next.id === DEFAULT_THEME_ID ? null : next)
}

defineExpose({ setZoomLabel })
</script>

<style scoped>
.canvas-controls {
  position: fixed;
  z-index: var(--z-menu);
  inset-block-start: var(--spacing-sm);
  inset-inline-end: var(--spacing-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--foreground);
  cursor: default;
}

.canvas-controls :deep(button),
.canvas-theme,
.canvas-theme select {
  cursor: default;
}

.canvas-zoom {
  min-width: 3rem;
  color: var(--foreground-muted);
  font-size: var(--text-eyebrow);
  text-align: center;
}

.canvas-theme {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  color: var(--foreground-muted);
  font-size: var(--text-eyebrow);
}

.canvas-theme select {
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  padding: var(--spacing-xxs) var(--spacing-xs);
}

.canvas-controls :deep(button:focus-visible),
.canvas-theme select:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>
