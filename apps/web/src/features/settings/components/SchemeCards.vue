<template>
  <div class="scheme-cards" role="radiogroup" :aria-label="t('settings.theme')">
    <button
      v-for="option in schemes"
      :key="option.id"
      type="button"
      class="scheme-card"
      role="radio"
      :aria-checked="scheme === option.id"
      @click="setScheme(option.id)"
    >
      <span class="scheme-wire" :data-tone="wireTone(option.id)" aria-hidden="true">
        <span class="wire-side" />

        <span class="wire-main">
          <span class="wire-line" />
          <span class="wire-line" />
          <span class="wire-line short" />

          <span class="wire-composer">
            <span class="wire-knob" />
          </span>
        </span>
      </span>

      <span class="scheme-label">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import { useI18n } from "@i18n/index.js"
import { useColorScheme } from "@features/theme/index.js"

const { t } = useI18n()
const { isDark, scheme, setScheme } = useColorScheme()

function wireTone(id: ColorScheme): "light" | "dark" | "split" {
  if (id === "light") return "light"

  if (id === "dark") return "dark"
  return isDark.value ? "split" : "light"
}

/* 列表文案随语言切换，必须走 computed；setup 里一次性求值会在切语言后停住 */
const schemes = computed<{ id: ColorScheme; label: string }[]>(() => [
  { id: "auto", label: t("settings.schemeAuto") },
  { id: "light", label: t("settings.schemeLight") },
  { id: "dark", label: t("settings.schemeDark") },
])
</script>

<style scoped>
.scheme-cards {
  display: grid;
  gap: var(--space-sm);
  grid-template-columns: repeat(3, 1fr);
}

.scheme-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--contrast-foreground-faint);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.scheme-card:hover {
  background: var(--btn-hover);
  color: var(--contrast-foreground);
}

.scheme-card[aria-checked="true"] {
  border-color: var(--primary);
  color: var(--contrast-foreground);
}

.scheme-wire {
  display: flex;
  overflow: hidden;
  height: 6.5rem;
  border: var(--border-width) solid var(--border-soft);
  border-radius: max(calc(var(--radius-control) / 2), calc(var(--radius-card) - var(--space-sm)));
  background: var(--theme-wire-light);
}

/* 线框默认画浅色界面；dark 画深色，split 只把侧栏画深色。 */
.scheme-wire[data-tone="dark"] {
  background: var(--theme-wire-dark);
}

.scheme-wire[data-tone="dark"] .wire-side,
.scheme-wire[data-tone="split"] .wire-side {
  background: var(--theme-wire-dark-raised);
}

.scheme-wire[data-tone="dark"] .wire-line,
.scheme-wire[data-tone="split"] .wire-side .wire-line {
  background: var(--white);
  opacity: var(--opacity-disabled);
}

.scheme-wire[data-tone="dark"] .wire-composer {
  background: var(--theme-wire-dark-raised);
}

.wire-side {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-xxs);
  width: 28%;
  padding: var(--space-xs);
  background: var(--theme-wire-light-raised);
}

.wire-side::before,
.wire-side::after {
  content: "";
  height: var(--space-xxs);
  border-radius: var(--radius-pill);
  background: var(--border);
}

.wire-side::after {
  width: 70%;
}

.wire-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-xxs);
  padding: var(--space-xs);
}

.wire-line {
  height: var(--space-xxs);
  border-radius: var(--radius-pill);
  background: var(--border);
}

.wire-line.short {
  width: 60%;
}

.wire-composer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: auto;
  height: var(--space-md);
  padding-inline: var(--space-xxs);
  border-radius: var(--radius-pill);
  background: var(--theme-wire-light-raised);
}

.wire-knob {
  width: var(--space-sm);
  height: var(--space-sm);
  border-radius: var(--radius-pill);
  background: var(--primary);
}

.scheme-label {
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .scheme-card {
    transition: none;
  }
}

@media (max-width: 720px) {
  .scheme-cards {
    grid-template-columns: 1fr;
  }
}
</style>
