<template>
  <section class="pane">
    <section class="group">
      <h2 class="group-title">{{ t("settings.appearance") }}</h2>

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
    </section>

    <section class="group">
      <h2 class="group-title">{{ t("settings.accent") }}</h2>

      <div class="accent-grid" role="radiogroup" :aria-label="t('settings.accent')">
        <button
          v-for="accent in ACCENTS"
          :key="accent.id"
          type="button"
          class="accent-swatch"
          role="radio"
          :aria-checked="selectedAccent === accent.id"
          :aria-label="accent.label"
          :data-accent="accent.id"
          @click="setAccentById(accent.id)"
        >
          <span class="swatch-ball" :style="{ background: swatchColor(accent) }">
            <CheckIcon v-if="selectedAccent === accent.id" class="swatch-mark" />
          </span>
        </button>
      </div>
    </section>

    <section class="group">
      <h2 class="group-title">{{ t("settings.interface") }}</h2>

      <div class="card">
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
              :min="40"
              :max="100"
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
import { computed } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import { useI18n } from "@i18n/index.js"
import { useSound } from "@features/click-sound/index.js"
import { useGeneralPrefs, type FontSize, type UiLocale } from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { ACCENTS, DEFAULT_ACCENT_ID, type AccentId } from "@features/theme/lib/accents.js"
import { Switch } from "@components/ui/switch/index.js"
import { Slider } from "@components/ui/slider/index.js"
import { CheckIcon } from "@components/icons/index.js"

const { t } = useI18n()
const { isDark, scheme, accent, setScheme, setAccent } = useColorScheme()
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
const selectedAccent = computed(() => accent.value)

function setAccentById(id: AccentId) {
  setAccent(id === DEFAULT_ACCENT_ID ? null : id)
}

function swatchColor(a: (typeof ACCENTS)[number]) {
  return isDark.value ? a.dark.step9 : a.light.step9
}

function wireTone(id: ColorScheme): "light" | "dark" | "split" {
  if (id === "light") return "light"

  if (id === "dark") return "dark"
  return isDark.value ? "split" : "light"
}

const schemes: { id: ColorScheme; label: string }[] = [
  { id: "auto", label: t("settings.schemeAuto") },
  { id: "light", label: t("settings.schemeLight") },
  { id: "dark", label: t("settings.schemeDark") },
]
const locales: { id: UiLocale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: t("settings.zhCN") },
]
const sizes: { id: FontSize; mark: string; label: string }[] = [
  { id: "s", mark: "S", label: t("settings.fontSizeS") },
  { id: "m", mark: "M", label: t("settings.fontSizeM") },
  { id: "l", mark: "L", label: t("settings.fontSizeL") },
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
  gap: var(--space-xl);
  padding-block-end: var(--space-md);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.group-title {
  margin: 0;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
}

.card {
  display: flex;
  flex-direction: column;
  padding-inline: var(--space-md);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--background);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  min-height: calc(var(--size-control) + var(--space-lg));
  padding-block: var(--space-sm);
}

.row + .row {
  border-top: var(--border-width) solid var(--border-subtle);
}

.copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-xxs);
}

.label {
  margin: 0;
  color: var(--contrast-foreground);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-md--line-height);
}

.hint {
  margin: 0;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}

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
  border-radius: var(--radius-xl);
  background: var(--card);
  color: var(--contrast-foreground-muted);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.scheme-card:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.scheme-card[aria-checked="true"] {
  border-color: var(--primary);
  color: var(--contrast-foreground);
  box-shadow: var(--focus-ring);
}

.scheme-wire {
  display: flex;
  overflow: hidden;
  height: 6.5rem;
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-lg);
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
  border-radius: var(--radius-full);
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
  border-radius: var(--radius-full);
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
  border-radius: var(--radius-full);
  background: var(--theme-wire-light-raised);
}

.wire-knob {
  width: var(--space-sm);
  height: var(--space-sm);
  border-radius: var(--radius-full);
  background: var(--primary);
}

.scheme-label {
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: center;
}

.accent-grid {
  display: grid;
  gap: var(--space-sm);
  grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));
}

.accent-swatch {
  display: grid;
  place-items: center;
  padding: var(--space-xs);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--contrast-foreground-muted);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.accent-swatch:hover {
  background: var(--hover-quiet);
}

.accent-swatch[aria-checked="true"] {
  border-color: var(--primary);
  color: var(--contrast-foreground);
  box-shadow: var(--focus-ring);
}

.swatch-ball {
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  color: var(--white);
}

.swatch-mark {
  width: var(--size-icon-2xs);
  height: var(--size-icon-2xs);
  color: var(--accent-contrast, var(--white));
}

.segment {
  display: inline-flex;
  flex: none;
  gap: var(--space-xxs);
  padding: var(--space-xxs);
  border-radius: var(--radius-lg);
  background: var(--card);
}

.segment-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  min-height: var(--size-icon-button);
  padding: var(--space-xxs) var(--space-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  white-space: nowrap;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.segment-btn:hover {
  color: var(--contrast-foreground);
}

.segment-btn[aria-checked="true"] {
  background: var(--interaction-selected);
  color: var(--contrast-foreground);
}

.size-btn {
  justify-content: center;
  min-width: var(--size-icon-button);
  padding-inline: var(--space-xs);
}

.opacity-control {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-sm);
}

.opacity-slider {
  width: 8rem;
}

.opacity-value {
  min-width: 3ch;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

@media (prefers-reduced-motion: reduce) {
  .scheme-card,
  .accent-swatch,
  .segment-btn {
    transition: none;
  }
}

@media (max-width: 720px) {
  .scheme-cards {
    grid-template-columns: 1fr;
  }

  .row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
