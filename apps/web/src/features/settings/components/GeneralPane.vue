<template>
  <section class="pane">
    <section class="group">
      <h2 class="group-title">外观</h2>

      <div class="card">
        <div class="row">
          <div class="copy">
            <h3 class="label">外观</h3>
            <p class="hint">选择应用的明暗外观</p>
          </div>

          <div class="segment" role="radiogroup" aria-label="外观">
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
            <h3 class="label">语言</h3>
            <p class="hint">选择界面显示语言</p>
          </div>

          <div class="segment" role="radiogroup" aria-label="语言">
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
            <h3 class="label">字体大小</h3>
            <p class="hint">调整界面和消息文字大小</p>
          </div>

          <div class="segment" role="radiogroup" aria-label="字体大小">
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
      <h2 class="group-title">通知</h2>

      <div class="card">
        <div class="row">
          <div class="copy">
            <h3 class="label">系统通知</h3>
            <p class="hint">回合完成时发送系统通知</p>
          </div>

          <button
            type="button"
            class="switch"
            role="switch"
            aria-label="系统通知"
            :aria-checked="notifyOn"
            @click="onNotify"
          >
            <span class="switch-thumb" />
          </button>
        </div>

        <div class="row">
          <div class="copy">
            <h3 class="label">完成提示音</h3>
            <p class="hint">回合完成时播放提示音</p>
          </div>

          <button
            type="button"
            class="switch"
            role="switch"
            aria-label="完成提示音"
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
import { useSound } from "@features/click-sound/index.js"
import { useGeneralPrefs, type FontSize, type UiLocale } from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"

const { scheme, setScheme } = useColorScheme()
const { enabled: soundOn, toggle: toggleSound } = useSound()
const { locale, fontSize, notifyOn, setLocale, setFontSize, setNotify } = useGeneralPrefs()
const schemes: { id: ColorScheme; label: string; icon: typeof Monitor }[] = [
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
  { id: "auto", label: "跟随系统", icon: Monitor },
]
const locales: { id: UiLocale; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "简体中文" },
]
const sizes: { id: FontSize; mark: string; label: string }[] = [
  { id: "s", mark: "S", label: "小" },
  { id: "m", mark: "M", label: "中" },
  { id: "l", mark: "L", label: "大" },
  { id: "xl", mark: "XL", label: "特大" },
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
