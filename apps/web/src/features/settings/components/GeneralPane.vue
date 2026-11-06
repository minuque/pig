<template>
  <section class="pane">
    <section id="setting-appearance" class="group">
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
      <h2 class="group-title">{{ t("settings.interface") }}</h2>

      <div class="card">
        <div id="setting-user-name" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.userName") }}</h3>
            <p class="hint">{{ t("settings.userNameHint") }}</p>
          </div>

          <TextFieldRoot
            :model-value="userName"
            size="s"
            class="setting-select"
            placeholder="Pig"
            :aria-label="t('settings.userName')"
            @update:model-value="setUserName"
          />
        </div>

        <div id="setting-language" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.language") }}</h3>
            <p class="hint">{{ t("settings.languageHint") }}</p>
          </div>

          <Select :model-value="locale" size="s" @update:model-value="onLocale">
            <SelectTrigger class="setting-select" :aria-label="t('settings.language')">
              {{ localeLabel }}
            </SelectTrigger>

            <SelectContent>
              <SelectItem v-for="option in locales" :key="option.id" :value="option.id">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div id="setting-font-size" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.fontSize") }}</h3>
            <p class="hint">{{ t("settings.fontSizeHint") }}</p>
          </div>

          <SegmentedControl
            :model-value="fontSize"
            size="s"
            :aria-label="t('settings.fontSize')"
            @update:model-value="onFontSize"
          >
            <SegmentedControlItem
              v-for="option in sizes"
              :key="option.id"
              :value="option.id"
              :aria-label="option.label"
            >
              {{ option.mark }}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>

        <div id="setting-chat-width" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.chatWidth") }}</h3>
            <p class="hint">{{ t("settings.chatWidthHint") }}</p>
          </div>

          <Select :model-value="chatWidth" size="s" @update:model-value="onChatWidth">
            <SelectTrigger class="setting-select" :aria-label="t('settings.chatWidth')">
              {{ widthLabel }}
            </SelectTrigger>

            <SelectContent>
              <SelectItem v-for="option in widths" :key="option.id" :value="option.id">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div id="setting-accent" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.accent") }}</h3>
            <p class="hint">{{ accentHint }}</p>
          </div>

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
        </div>

        <div id="setting-translucent" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.translucentWindow") }}</h3>
            <p class="hint">{{ t("settings.translucentWindowHint") }}</p>
          </div>

          <Switch
            :aria-label="t('settings.translucentWindow')"
            :model-value="translucentWindow"
            @update:model-value="setTranslucentWindow"
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
import {
  useGeneralPrefs,
  type ChatWidth,
  type FontSize,
  type UiLocale,
} from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"
import {
  ACCENTS,
  DEFAULT_ACCENT_ID,
  findAccent,
  type AccentId,
} from "@features/theme/lib/accents.js"
import { accentHex } from "@features/theme/lib/palette.js"
import { SegmentedControl, SegmentedControlItem } from "@components/ui/segmented-control/index.js"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@components/ui/select/index.js"
import { Switch } from "@components/ui/switch/index.js"
import { TextFieldRoot } from "@components/ui/text-field/index.js"
import { CheckIcon } from "@components/icons/index.js"

const { t } = useI18n()
const { isDark, scheme, accent, setScheme, setAccent } = useColorScheme()
const {
  locale,
  fontSize,
  chatWidth,
  translucentWindow,
  userName,
  setUserName,
  setLocale,
  setFontSize,
  setChatWidth,
  setTranslucentWindow,
} = useGeneralPrefs()
const selectedAccent = computed(() => accent.value)
const accentHint = computed(() => findAccent(selectedAccent.value).label)

function setAccentById(id: AccentId) {
  setAccent(id === DEFAULT_ACCENT_ID ? null : id)
}

/** 取色球用的实际色值：读计算样式，深浅切换自动跟随。 */
function swatchColor(a: (typeof ACCENTS)[number]) {
  void isDark.value
  return accentHex(a.id)
}

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

/** 分段控件只给字符串，转回各自的联合类型 */
function onLocale(value: string) {
  setLocale(value as UiLocale)
}

function onFontSize(value: string) {
  setFontSize(value as FontSize)
}

function onChatWidth(value: string) {
  setChatWidth(value as ChatWidth)
}

const locales = computed<{ id: UiLocale; label: string }[]>(() => [
  { id: "en", label: "English" },
  { id: "zh-CN", label: t("settings.zhCN") },
])
const sizes = computed<{ id: FontSize; mark: string; label: string }[]>(() => [
  { id: "s", mark: "S", label: t("settings.fontSizeS") },
  { id: "m", mark: "M", label: t("settings.fontSizeM") },
  { id: "l", mark: "L", label: t("settings.fontSizeL") },
])
const widths = computed<{ id: ChatWidth; label: string }[]>(() => [
  { id: "comfortable", label: t("settings.chatWidthComfortable") },
  { id: "wide", label: t("settings.chatWidthWide") },
  { id: "full", label: t("settings.chatWidthFull") },
])
/* 触发器文案自己算：SelectValue 缓存的选中项文字不会跟着切语言更新 */
const localeLabel = computed(
  () => locales.value.find((option) => option.id === locale.value)?.label ?? "",
)
const widthLabel = computed(
  () => widths.value.find((option) => option.id === chatWidth.value)?.label ?? "",
)
</script>

<style scoped src="./pane.css"></style>

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
  border: var(--border-width) solid var(--border-soft);
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
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: center;
}

.accent-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-xs);
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
  border-radius: var(--radius-pill);
  color: var(--white);
}

.swatch-mark {
  width: var(--size-icon-2xs);
  height: var(--size-icon-2xs);
  color: var(--accent-contrast, var(--white));
}

/* 下拉框定宽：不同选项文字长短不一，避免选中后触发器宽度跳动 */
.setting-select {
  inline-size: 10rem;
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

  .accent-grid {
    justify-content: flex-start;
  }
}
</style>
