<template>
  <section class="pane">
    <section class="group">
      <h2 class="group-title">{{ t("settings.appearance") }}</h2>

      <div class="card">
        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.appearance") }}</h3>
            <p class="hint">{{ t("settings.appearanceHint") }}</p>
          </div>

          <div class="scheme-cards" role="radiogroup" :aria-label="t('settings.appearance')">
            <button
              v-for="option in schemes"
              :key="option.id"
              type="button"
              class="scheme-card"
              role="radio"
              :aria-checked="scheme === option.id"
              @click="setScheme(option.id)"
            >
              <component :is="option.icon" class="size-icon" />
              <span class="scheme-label">{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div class="theme-grid" role="radiogroup" :aria-label="t('settings.theme')">
          <button
            v-for="theme in THEMES"
            :key="theme.id"
            type="button"
            class="theme-card"
            role="radio"
            :aria-checked="themeId === theme.id"
            :data-theme-id="theme.id"
            @click="setThemeById(theme.id)"
          >
            <span class="theme-preview" :data-mode="scheme === 'auto' ? 'split' : scheme">
              <span
                class="theme-ball"
                :style="ballStyle(theme.lightPreview, 'light')"
                aria-hidden="true"
              />

              <span
                class="theme-ball"
                :style="ballStyle(theme.darkPreview, 'dark')"
                aria-hidden="true"
              />
            </span>

            <span class="theme-name">{{ theme.label }}</span>
          </button>
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.language") }}</h3>
            <p class="hint">{{ t("settings.languageHint") }}</p>
          </div>

          <div class="segment" role="radiogroup" :aria-label="t('settings.language')">
            <button
              v-for="option in locales"
              :key="option.id"
              type="button"
              class="segment-btn"
              role="radio"
              :aria-checked="locale === option.id"
              @click="setLocale(option.id)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.fontSize") }}</h3>
            <p class="hint">{{ t("settings.fontSizeHint") }}</p>
          </div>

          <div class="segment" role="radiogroup" :aria-label="t('settings.fontSize')">
            <button
              v-for="option in sizes"
              :key="option.id"
              type="button"
              class="segment-btn size-btn"
              role="radio"
              :aria-label="option.label"
              :aria-checked="fontSize === option.id"
              @click="setFontSize(option.id)"
            >
              {{ option.mark }}
            </button>
          </div>
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.glass") }}</h3>
            <p class="hint">{{ t("settings.glassHint") }}</p>
          </div>

          <Switch
            :aria-label="t('settings.glass')"
            :model-value="glassOn"
            @update:model-value="setGlass"
          />
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.glassOpacity") }}</h3>
            <p class="hint">{{ t("settings.glassOpacityHint") }}</p>
          </div>

          <div class="opacity-control">
            <Slider
              :aria-label="t('settings.glassOpacity')"
              :model-value="[glassOpacity]"
              :min="5"
              :max="95"
              :step="5"
              :disabled="!glassOn"
              class="opacity-slider"
              @update:model-value="onOpacity"
            />

            <span class="opacity-value">{{ glassOpacity }}%</span>
          </div>
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.contrast") }}</h3>
            <p class="hint">{{ t("settings.contrastHint") }}</p>
          </div>

          <div class="opacity-control">
            <Slider
              :aria-label="t('settings.contrast')"
              :model-value="[contrastBoost]"
              :min="0"
              :max="100"
              :step="10"
              class="opacity-slider"
              @update:model-value="onContrast"
            />

            <span class="opacity-value">{{ contrastBoost }}%</span>
          </div>
        </div>
      </div>
    </section>

    <section class="group">
      <h2 class="group-title">{{ t("settings.notifications") }}</h2>

      <div class="card">
        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.notifySystem") }}</h3>
            <p class="hint">{{ t("settings.notifySystemHint") }}</p>
          </div>

          <Switch
            :aria-label="t('settings.notifySystem')"
            :model-value="notifyOn"
            @update:model-value="onNotify"
          />
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.notifySound") }}</h3>
            <p class="hint">{{ t("settings.notifySoundHint") }}</p>
          </div>

          <Switch
            :aria-label="t('settings.notifySound')"
            :model-value="soundOn"
            @update:model-value="toggleSound()"
          />
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { shallowRef } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import { useI18n } from "@i18n/index.js"
import { useSound } from "@features/click-sound/index.js"
import { useGeneralPrefs, type FontSize, type UiLocale } from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { THEMES, type ThemePreview } from "@features/theme/lib/palette.js"
import { Switch } from "@components/ui/switch/index.js"
import { Slider } from "@components/ui/slider/index.js"
import { MonitorIcon, MoonIcon, SunIcon } from "@components/icons/index.js"

const { t } = useI18n()
const { scheme, themeId, setScheme, setTheme } = useColorScheme()
const { enabled: soundOn, toggle: toggleSound } = useSound()
const {
  locale,
  fontSize,
  notifyOn,
  glassOn,
  glassOpacity,
  contrastBoost,
  setLocale,
  setFontSize,
  setNotify,
  setGlass,
  setGlassOpacity,
  setContrastBoost,
} = useGeneralPrefs()

function setThemeById(id: string | null) {
  setTheme(id === null ? null : (THEMES.find((theme) => theme.id === id) ?? null))
}

function ballStyle(preview: ThemePreview, mode: "light" | "dark") {
  const base = mode === "light" ? "#ffffff" : "#0f0f11"
  return {
    background: [
      `radial-gradient(circle at 30% 30% in oklab, ${preview.accent} 0%, transparent 60%)`,
      `radial-gradient(circle at 75% 75% in oklab, ${preview.messageAction}40 0%, transparent 60%)`,
      `color-mix(in oklab, ${preview.canvas} 88%, ${base})`,
    ].join(", "),
    boxShadow:
      mode === "dark"
        ? "inset 0 0 0 1px rgb(255 255 255 / 0.14), 0 1px 2px rgb(0 0 0 / 0.18)"
        : "inset 0 0 0 1px rgb(0 0 0 / 0.10), 0 1px 2px rgb(0 0 0 / 0.08)",
  }
}

const schemes: { id: ColorScheme; label: string; icon: typeof MonitorIcon }[] = [
  { id: "light", label: t("settings.schemeLight"), icon: SunIcon },
  { id: "dark", label: t("settings.schemeDark"), icon: MoonIcon },
  { id: "auto", label: t("settings.schemeAuto"), icon: MonitorIcon },
]
const locales: { id: UiLocale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: t("settings.zhCN") },
]
const sizes: { id: FontSize; mark: string; label: string }[] = [
  { id: "s", mark: "S", label: t("settings.fontSizeS") },
  { id: "m", mark: "M", label: t("settings.fontSizeM") },
  { id: "l", mark: "L", label: t("settings.fontSizeL") },
  { id: "xl", mark: "XL", label: t("settings.fontSizeXl") },
]

function onOpacity(value: number[] | undefined) {
  if (value?.[0] !== undefined) setGlassOpacity(value[0])
}

function onContrast(value: number[] | undefined) {
  if (value?.[0] !== undefined) setContrastBoost(value[0])
}

async function onNotify(next: boolean) {
  if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
    const result = await Notification.requestPermission()

    if (result !== "granted") return
  }

  setNotify(next)
}
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding-block-end: var(--spacing-md);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.group-title {
  margin: 0;
  color: var(--contrast-ink);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-title--line-height);
}

.card {
  display: flex;
  flex-direction: column;
  padding-inline: var(--spacing-md);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--canvas);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-height: calc(var(--size-control) + var(--spacing-lg));
  padding-block: var(--spacing-sm);
}

.row + .row {
  border-top: var(--border-width) solid var(--border-subtle);
}

.copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.label {
  margin: 0;
  color: var(--contrast-ink);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-md--line-height);
}

.hint {
  margin: 0;
  color: var(--contrast-ink-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}

.scheme-cards {
  display: flex;
  gap: var(--spacing-sm);
}

.scheme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xxs);
  width: 4.5rem;
  padding: var(--spacing-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--contrast-ink-muted);
}

.scheme-card:hover {
  background: var(--hover-quiet);
  color: var(--contrast-ink);
}

.scheme-card[aria-checked="true"] {
  border-color: var(--primary);
  background: var(--interaction-selected);
  color: var(--contrast-ink);
}

.scheme-label {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
}

.theme-grid {
  display: grid;
  gap: var(--spacing-sm);
  padding-block: var(--spacing-sm);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-xxs);
  padding: var(--spacing-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--contrast-ink-muted);
}

.theme-card:hover {
  background: var(--hover-quiet);
  color: var(--contrast-ink);
}

.theme-card[aria-checked="true"] {
  border-color: var(--primary);
  background: var(--interaction-selected);
  color: var(--contrast-ink);
}

.theme-preview {
  display: flex;
  justify-content: center;
  gap: var(--spacing-xxs);
}

.theme-ball {
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid var(--surface);
  border-radius: var(--radius-full);
}

.theme-name {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: center;
}

.segment {
  display: inline-flex;
  flex: none;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.segment-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: var(--size-icon-button);
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  white-space: nowrap;
}

.segment-btn:hover {
  color: var(--contrast-ink);
}

.segment-btn[aria-checked="true"] {
  background: var(--interaction-selected);
  color: var(--contrast-ink);
}

.size-btn {
  justify-content: center;
  min-width: var(--size-icon-button);
  padding-inline: var(--spacing-xs);
}

.opacity-control {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-sm);
}

.opacity-slider {
  width: 8rem;
}

.opacity-value {
  min-width: 3ch;
  color: var(--contrast-ink-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

@media (max-width: 720px) {
  .row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
