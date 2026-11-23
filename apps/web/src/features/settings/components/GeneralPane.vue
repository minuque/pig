<template>
  <section class="pane">
    <section class="group">
      <h2 class="group-title">{{ t("settings.interface") }}</h2>

      <CardList>
        <CardRow id="setting-user-name" class="row">
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
        </CardRow>

        <CardRow id="setting-language" class="row">
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
        </CardRow>
      </CardList>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { useGeneralPrefs, type UiLocale } from "@features/settings/index.js"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@pig/ui/select"
import { TextFieldRoot } from "@pig/ui/text-field"
import { CardList, CardRow } from "@pig/ui/card"

const { t } = useI18n()
const { locale, userName, setUserName, setLocale } = useGeneralPrefs()

function onLocale(value: string) {
  setLocale(value as UiLocale)
}

const locales = computed<{ id: UiLocale; label: string }[]>(() => [
  { id: "en", label: "English" },
  { id: "zh-CN", label: t("settings.zhCN") },
])
const localeLabel = computed(
  () => locales.value.find((option) => option.id === locale.value)?.label ?? "",
)
</script>

<style scoped src="./pane.css"></style>

<style scoped>
.setting-select {
  inline-size: 10rem;
}
</style>
