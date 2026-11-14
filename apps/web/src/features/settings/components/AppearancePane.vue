<template>
  <section class="pane">
    <section id="setting-theme" class="group">
      <h2 class="group-title">{{ t("settings.theme") }}</h2>
      <SchemeCards />
    </section>

    <section class="group">
      <h2 class="group-title">{{ t("settings.display") }}</h2>

      <Card size="s" class="card">
        <div id="setting-welcome-field" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.welcomeField") }}</h3>
            <p class="desc">{{ t("settings.welcomeFieldHint") }}</p>
          </div>

          <Select :model-value="welcomeField" @update:model-value="onWelcomeField">
            <SelectTrigger class="setting-select" :aria-label="t('settings.welcomeField')">
              {{ welcomeLabel }}
            </SelectTrigger>

            <SelectContent>
              <SelectItem v-for="option in fields" :key="option.id" :value="option.id">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div id="setting-ui-font" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.uiFont") }}</h3>
            <p class="desc">{{ t("settings.uiFontHint") }}</p>
          </div>

          <Select
            :model-value="uiFont || DEFAULT"
            @update:open="onFontsOpen"
            @update:model-value="onUiFont"
          >
            <SelectTrigger class="setting-select" :aria-label="t('settings.uiFont')">
              <span class="font-name" :style="{ fontFamily: 'var(--font-sans)' }">
                {{ uiFont || t("settings.fontDefault") }}
              </span>
            </SelectTrigger>

            <SelectContent>
              <SelectItem :value="DEFAULT">{{ t("settings.fontDefault") }}</SelectItem>

              <SelectItem
                v-for="family in fontList(families, uiFont)"
                :key="family"
                :value="family"
                :style="{ fontFamily: quote(family) }"
              >
                {{ family }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div id="setting-code-font" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.codeFont") }}</h3>
            <p class="desc">{{ t("settings.codeFontHint") }}</p>
          </div>

          <Select
            :model-value="codeFont || DEFAULT"
            @update:open="onFontsOpen"
            @update:model-value="onCodeFont"
          >
            <SelectTrigger class="setting-select" :aria-label="t('settings.codeFont')">
              <span class="font-name" :style="{ fontFamily: 'var(--font-mono)' }">
                {{ codeFont || t("settings.fontDefault") }}
              </span>
            </SelectTrigger>

            <SelectContent>
              <SelectItem :value="DEFAULT">{{ t("settings.fontDefault") }}</SelectItem>

              <SelectItem
                v-for="family in fontList(mono, codeFont)"
                :key="family"
                :value="family"
                :style="{ fontFamily: quote(family) }"
              >
                {{ family }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div id="setting-chat-width" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.chatWidth") }}</h3>
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
        </div>
      </Card>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import {
  useAppearancePrefs,
  useGeneralPrefs,
  type ChatWidth,
  type WelcomeField,
} from "@features/settings/index.js"
import { useLocalFonts } from "@features/settings/hooks/use-local-fonts.js"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@components/ui/select/index.js"
import { Card } from "@components/ui/card/index.js"
import SchemeCards from "./SchemeCards.vue"

/** Select 的值不能是空串，默认字体用占位值。 */
const DEFAULT = "__default__"
const { t } = useI18n()
const { chatWidth, setChatWidth } = useGeneralPrefs()
const { welcomeField, uiFont, codeFont, setWelcomeField, setUiFont, setCodeFont } =
  useAppearancePrefs()
const { families, mono, load } = useLocalFonts()

function onUiFont(value: string) {
  setUiFont(value === DEFAULT ? "" : value)
}

function onCodeFont(value: string) {
  setCodeFont(value === DEFAULT ? "" : value)
}

function quote(family: string): string {
  return JSON.stringify(family)
}

/** 已选字体不在本机列表里（换了电脑或还没读到）时也留在选项里，触发器才对得上。 */
function fontList(list: readonly string[], current: string): string[] {
  return current && !list.includes(current) ? [current, ...list] : [...list]
}

/** 下拉打开才读本机字体：浏览器要求在用户操作里申请。 */
function onFontsOpen(open: boolean) {
  if (open) void load()
}

function onWelcomeField(value: string) {
  setWelcomeField(value as WelcomeField)
}

function onChatWidth(value: string) {
  setChatWidth(value as ChatWidth)
}

/* 列表文案随语言切换，必须走 computed */
const fields = computed<{ id: WelcomeField; label: string }[]>(() => [
  { id: "mask", label: t("settings.welcomeFieldMask") },
  { id: "off", label: t("settings.welcomeFieldOff") },
])
const widths = computed<{ id: ChatWidth; label: string }[]>(() => [
  { id: "comfortable", label: t("settings.chatWidthComfortable") },
  { id: "wide", label: t("settings.chatWidthWide") },
  { id: "full", label: t("settings.chatWidthFull") },
])
/* 触发器文案自己算：SelectValue 缓存的选中项文字不会跟着切语言更新 */
const welcomeLabel = computed(
  () => fields.value.find((option) => option.id === welcomeField.value)?.label ?? "",
)
const widthLabel = computed(
  () => widths.value.find((option) => option.id === chatWidth.value)?.label ?? "",
)
</script>

<style scoped src="./pane.css"></style>

<style scoped>
/* 下拉框定宽：不同选项文字长短不一，避免选中后触发器宽度跳动 */
.setting-select {
  inline-size: 12rem;
}

.font-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
