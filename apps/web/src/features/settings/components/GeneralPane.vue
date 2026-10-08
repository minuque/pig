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

          <div class="segment" role="radiogroup" :aria-label="t('settings.appearance')">
            <button
              v-for="option in schemes"
              :key="option.id"
              type="button"
              class="segment-btn"
              role="radio"
              :aria-checked="scheme === option.id"
              @click="setScheme(option.id)"
            >
              <component :is="option.icon" class="size-icon" />
              {{ option.label }}
            </button>
          </div>
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

          <button
            type="button"
            class="switch"
            role="switch"
            :aria-label="t('settings.notifySystem')"
            :aria-checked="notifyOn"
            @click="onNotify"
          >
            <span class="switch-thumb" />
          </button>
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.notifySound") }}</h3>
            <p class="hint">{{ t("settings.notifySoundHint") }}</p>
          </div>

          <button
            type="button"
            class="switch"
            role="switch"
            :aria-label="t('settings.notifySound')"
            :aria-checked="soundOn"
            @click="toggleSound()"
          >
            <span class="switch-thumb" />
          </button>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { Monitor, Moon, Sun } from "@lucide/vue"
import type { ColorScheme } from "@/types/theme-type.js"
import { useI18n } from "@i18n/index.js"
import { useSound } from "@features/click-sound/index.js"
import { useGeneralPrefs, type FontSize, type UiLocale } from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"

const { t } = useI18n()
const { scheme, setScheme } = useColorScheme()
const { enabled: soundOn, toggle: toggleSound } = useSound()
const { locale, fontSize, notifyOn, setLocale, setFontSize, setNotify } = useGeneralPrefs()
const schemes: { id: ColorScheme; label: string; icon: typeof Monitor }[] = [
  { id: "light", label: t("settings.schemeLight"), icon: Sun },
  { id: "dark", label: t("settings.schemeDark"), icon: Moon },
  { id: "auto", label: t("settings.schemeAuto"), icon: Monitor },
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

async function onNotify() {
  const next = !notifyOn.value

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
  color: var(--ink);
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
  color: var(--ink);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-md--line-height);
}

.hint {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
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
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  white-space: nowrap;
}

.segment-btn:hover {
  color: var(--ink);
}

.segment-btn[aria-checked="true"] {
  background: var(--interaction-selected);
  color: var(--ink);
}

.size-btn {
  justify-content: center;
  min-width: var(--size-icon-button);
  padding-inline: var(--spacing-xs);
}

.switch {
  position: relative;
  flex: none;
  width: calc(var(--size-control) + var(--spacing-xxs));
  height: calc(var(--size-icon-button) - var(--spacing-xxs));
  padding: var(--spacing-xxs);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--border);
}

.switch[aria-checked="true"] {
  background: var(--primary);
}

.switch-thumb {
  display: block;
  width: calc(var(--size-icon) + var(--spacing-xxs));
  height: calc(var(--size-icon) + var(--spacing-xxs));
  border-radius: var(--radius-full);
  background: var(--white);
  transition: translate var(--duration-fast) var(--ease-out);
}

.switch[aria-checked="true"] .switch-thumb {
  translate: calc(var(--size-icon) - var(--spacing-xxs));
}

@media (prefers-reduced-motion: reduce) {
  .switch-thumb {
    transition: none;
  }
}

@media (max-width: 720px) {
  .row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
