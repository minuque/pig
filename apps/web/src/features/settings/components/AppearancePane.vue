<template>
  <section class="pane">
    <section class="group">
      <h2 class="group-title">{{ t("settings.theme") }}</h2>

      <CardList>
        <CardRow id="setting-theme" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.scheme") }}</h3>
            </div>

            <p class="desc">{{ t("settings.schemeHint") }}</p>
          </div>

          <SchemeTabs />
        </CardRow>

        <CardRow id="setting-palette" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.palette") }}</h3>
              <SettingReset
                v-if="palette !== DEFAULTS.palette"
                @reset="setPalette(DEFAULTS.palette)"
              />
            </div>

            <p class="desc">{{ t("settings.paletteHint") }}</p>
          </div>

          <Select :model-value="palette" @update:model-value="onPalette">
            <SelectTrigger class="setting-select" :aria-label="t('settings.palette')">
              {{ PALETTE_LABELS[palette] }}
            </SelectTrigger>

            <SelectContent>
              <SelectItem v-for="id in PALETTES" :key="id" :value="id">
                {{ PALETTE_LABELS[id] }}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardRow>

        <CardRow id="setting-code-theme" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.codeTheme") }}</h3>
              <SettingReset
                v-if="codeTheme !== DEFAULTS.codeTheme"
                @reset="setCodeTheme(DEFAULTS.codeTheme)"
              />
            </div>

            <p class="desc">{{ t("settings.codeThemeHint") }}</p>
          </div>

          <Select :model-value="codeTheme" @update:model-value="onCodeTheme">
            <SelectTrigger class="setting-select" :aria-label="t('settings.codeTheme')">
              {{ CODE_THEME_OPTIONS[codeTheme].label }}
            </SelectTrigger>

            <SelectContent>
              <SelectItem v-for="id in CODE_THEMES" :key="id" :value="id">
                {{ CODE_THEME_OPTIONS[id].label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardRow>
      </CardList>
    </section>

    <section class="group">
      <h2 class="group-title">{{ t("settings.display") }}</h2>

      <CardList>
        <CardRow id="setting-ui-font" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.uiFont") }}</h3>
              <SettingReset v-if="uiFont !== DEFAULTS.uiFont" @reset="setUiFont(DEFAULTS.uiFont)" />
            </div>

            <p class="desc">{{ t("settings.uiFontHint") }}</p>
          </div>

          <Select
            :items="uiFontItems"
            :model-value="uiFont || DEFAULT"
            @update:open="onFontsOpen"
            @update:model-value="onUiFont"
            @highlight="
              (_value: unknown, details: { index: number }) => revealFont(uiFontList, details.index)
            "
          >
            <SelectTrigger class="setting-select" :aria-label="t('settings.uiFont')">
              <span class="font-name" :style="{ fontFamily: 'var(--font-sans)' }">
                {{ uiFont || t("settings.fontDefault") }}
              </span>
            </SelectTrigger>

            <SelectContent>
              <SelectInput :placeholder="t('settings.searchFonts')" />
              <SelectEmpty v-slot="{ state }">
                {{ t("settings.noMatchingFonts", { query: state.query.trim() }) }}
              </SelectEmpty>

              <SelectList v-slot="{ state }" class="font-list">
                <FontOptionList ref="uiFontList" :items="asFontOptions(state.items)" />
              </SelectList>
            </SelectContent>
          </Select>
        </CardRow>

        <CardRow id="setting-contrast" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.contrast") }}</h3>

              <SettingReset
                v-if="contrast !== DEFAULTS.contrast"
                @reset="setContrast(DEFAULTS.contrast)"
              />
            </div>

            <p class="desc">{{ t("settings.contrastHint") }}</p>
          </div>

          <div class="contrast">
            <output class="contrast-value">{{ contrast }}%</output>

            <Slider
              :model-value="[contrast]"
              :min="CONTRAST_RANGE.min"
              :max="CONTRAST_RANGE.max"
              :step="CONTRAST_RANGE.step"
              size="s"
              :show-value-badge="false"
              :show-bounds="false"
              :aria-label="t('settings.contrast')"
              @update:model-value="onContrast"
            />
          </div>
        </CardRow>

        <CardRow id="setting-code-font" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.codeFont") }}</h3>

              <SettingReset
                v-if="codeFont !== DEFAULTS.codeFont"
                @reset="setCodeFont(DEFAULTS.codeFont)"
              />
            </div>

            <p class="desc">{{ t("settings.codeFontHint") }}</p>
          </div>

          <Select
            :items="codeFontItems"
            :model-value="codeFont || DEFAULT"
            @update:open="onFontsOpen"
            @update:model-value="onCodeFont"
            @highlight="
              (_value: unknown, details: { index: number }) =>
                revealFont(codeFontList, details.index)
            "
          >
            <SelectTrigger class="setting-select" :aria-label="t('settings.codeFont')">
              <span class="font-name" :style="{ fontFamily: 'var(--font-mono)' }">
                {{ codeFont || t("settings.fontDefault") }}
              </span>
            </SelectTrigger>

            <SelectContent>
              <SelectInput :placeholder="t('settings.searchFonts')" />
              <SelectEmpty v-slot="{ state }">
                {{ t("settings.noMatchingFonts", { query: state.query.trim() }) }}
              </SelectEmpty>

              <SelectList v-slot="{ state }" class="font-list">
                <FontOptionList ref="codeFontList" :items="asFontOptions(state.items)" />
              </SelectList>
            </SelectContent>
          </Select>
        </CardRow>

        <CardRow id="setting-code-size" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.codeSize") }}</h3>

              <SettingReset
                v-if="codeSize !== DEFAULTS.codeSize"
                @reset="setCodeSize(DEFAULTS.codeSize)"
              />
            </div>

            <p class="desc">{{ t("settings.codeSizeHint") }}</p>
          </div>

          <Select :model-value="String(codeSize)" @update:model-value="onCodeSize">
            <SelectTrigger class="setting-select" :aria-label="t('settings.codeSize')">
              {{ codeSizeLabel }}
            </SelectTrigger>

            <SelectContent>
              <SelectItem v-for="size in codeSizes" :key="size" :value="String(size)">
                {{ size }}px
              </SelectItem>
            </SelectContent>
          </Select>
        </CardRow>

        <CardRow id="setting-chat-width" class="row">
          <div class="copy">
            <div class="title">
              <h3 class="label">{{ t("settings.chatWidth") }}</h3>

              <SettingReset
                v-if="chatWidth !== DEFAULTS.chatWidth"
                @reset="setChatWidth(DEFAULTS.chatWidth)"
              />
            </div>

            <p class="desc">{{ t("settings.chatWidthHint") }}</p>
          </div>

          <Select :model-value="chatWidth" @update:model-value="onChatWidth">
            <SelectTrigger class="setting-select" :aria-label="t('settings.chatWidth')">
              {{ widthLabel }}
            </SelectTrigger>

            <SelectContent>
              <SelectItem v-for="option in widths" :key="option.id" :value="option.id">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardRow>
      </CardList>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { CODE_THEMES, DEFAULT_PREFERENCES as DEFAULTS, PALETTES } from "@client/preferences.js"
import type { UserCodeTheme, UserPalette } from "@/types/common-type.js"
import { useColorScheme } from "@features/theme/index.js"
import { CODE_THEME_OPTIONS } from "@features/theme/code-themes.js"
import { PALETTE_LABELS } from "@features/theme/palettes.js"
import {
  CODE_SIZES,
  CONTRAST_RANGE,
  useAppearancePrefs,
  useGeneralPrefs,
  type ChatWidth,
} from "@features/settings/index.js"
import { useLocalFonts } from "@features/settings/hooks/use-local-fonts.js"
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectInput,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@pig/ui/select"
import { CardList, CardRow } from "@pig/ui/card"
import { Slider } from "@pig/ui/slider"
import FontOptionList from "./FontOptionList.vue"
import SettingReset from "./SettingReset.vue"
import SchemeTabs from "./SchemeTabs.vue"
import { fontOptions, type FontOption } from "@features/settings/lib/font-options.js"

const DEFAULT = "__default__"
const { t } = useI18n()
const { chatWidth, setChatWidth } = useGeneralPrefs()
const { uiFont, codeFont, codeSize, contrast, setUiFont, setCodeFont, setCodeSize, setContrast } =
  useAppearancePrefs()
const { palette, codeTheme, setPalette, setCodeTheme } = useColorScheme()
const { families, mono, load } = useLocalFonts()
const uiFontList = shallowRef<InstanceType<typeof FontOptionList>>()
const codeFontList = shallowRef<InstanceType<typeof FontOptionList>>()
const uiFontItems = computed<FontOption[]>(() => [
  { value: DEFAULT, label: t("settings.fontDefault") },
  ...fontOptions(families.value, uiFont.value),
])
const codeFontItems = computed<FontOption[]>(() => [
  { value: DEFAULT, label: t("settings.fontDefault") },
  ...fontOptions(mono.value, codeFont.value),
])

function onUiFont(value: string) {
  setUiFont(value === DEFAULT ? "" : value)
}

function onCodeFont(value: string) {
  setCodeFont(value === DEFAULT ? "" : value)
}

function onCodeSize(value: string) {
  setCodeSize(Number(value))
}

function onContrast(value: number[]) {
  const [next] = value

  if (next !== undefined) setContrast(next)
}

function asFontOptions(items: readonly unknown[]): FontOption[] {
  return items as FontOption[]
}

function revealFont(list: InstanceType<typeof FontOptionList> | undefined, index: number) {
  list?.revealRow(index)
}

function onFontsOpen(open: boolean) {
  if (open) void load()
}

function onPalette(value: string) {
  setPalette(value as UserPalette)
}

function onCodeTheme(value: string) {
  setCodeTheme(value as UserCodeTheme)
}

function onChatWidth(value: string) {
  setChatWidth(value as ChatWidth)
}

const widths = computed<{ id: ChatWidth; label: string }[]>(() => [
  { id: "comfortable", label: t("settings.chatWidthComfortable") },
  { id: "wide", label: t("settings.chatWidthWide") },
  { id: "full", label: t("settings.chatWidthFull") },
])
const codeSizes = CODE_SIZES
const widthLabel = computed(
  () => widths.value.find((option) => option.id === chatWidth.value)?.label ?? "",
)
const codeSizeLabel = computed(() => `${codeSize.value}px`)
</script>

<style scoped src="./pane.css"></style>

<style scoped>
.setting-select {
  inline-size: 12rem;
}

.contrast {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  inline-size: 12rem;
}

.contrast-value {
  min-inline-size: 5ch;
  white-space: nowrap;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.font-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-list {
  display: flex;
  flex-direction: column;
  padding: 0;
}
</style>
