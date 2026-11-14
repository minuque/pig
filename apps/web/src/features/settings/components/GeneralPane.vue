<template>
  <section class="pane">
    <section class="group">
      <h2 class="group-title">{{ t("settings.interface") }}</h2>

      <Card size="s" class="card">
        <div id="setting-user-name" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.userName") }}</h3>
            <p class="desc">{{ t("settings.userNameHint") }}</p>
          </div>

          <TextFieldRoot
            :model-value="userName"
            class="setting-select"
            placeholder="Pig"
            :aria-label="t('settings.userName')"
            @update:model-value="setUserName"
          />
        </div>

        <div id="setting-language" class="row">
          <div class="copy">
            <h3 class="label">{{ t("settings.language") }}</h3>
            <p class="desc">{{ t("settings.languageHint") }}</p>
          </div>

          <Select :model-value="locale" @update:model-value="onLocale">
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
      </Card>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { useGeneralPrefs, type UiLocale } from "@features/settings/index.js"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@components/ui/select/index.js"
import { TextFieldRoot } from "@components/ui/text-field/index.js"
import { Card } from "@components/ui/card/index.js"

const { t } = useI18n()
const { locale, userName, setUserName, setLocale } = useGeneralPrefs()

/** Select 只给字符串，转回联合类型 */
function onLocale(value: string) {
  setLocale(value as UiLocale)
}

const locales = computed<{ id: UiLocale; label: string }[]>(() => [
  { id: "en", label: "English" },
  { id: "zh-CN", label: t("settings.zhCN") },
])
/* 触发器文案自己算：SelectValue 缓存的选中项文字不会跟着切语言更新 */
const localeLabel = computed(
  () => locales.value.find((option) => option.id === locale.value)?.label ?? "",
)
</script>

<style scoped src="./pane.css"></style>

<style scoped>
/* 下拉框定宽：不同选项文字长短不一，避免选中后触发器宽度跳动 */
.setting-select {
  inline-size: 10rem;
}
</style>
