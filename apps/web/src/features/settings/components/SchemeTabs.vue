<template>
  <TabsRoot :model-value="scheme" @update:model-value="(value) => setScheme(value as ColorScheme)">
    <TabsList variant="segmented" size="m" :aria-label="t('settings.scheme')">
      <Tooltip v-for="option in schemes" :key="option.id">
        <TooltipTrigger>
          <template #render="{ props: part }">
            <TabsTrigger v-bind="part" :value="option.id" :aria-label="option.label">
              <component :is="option.icon" :size="14" />
            </TabsTrigger>
          </template>
        </TooltipTrigger>

        <TooltipContent>{{ option.label }}</TooltipContent>
      </Tooltip>
    </TabsList>
  </TabsRoot>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { ColorScheme } from "@pig/ui/theme"
import { useI18n } from "@i18n/index.js"
import { useColorScheme } from "@features/theme/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { MonitorIcon, MoonIcon, SunIcon } from "@components/icons/index.js"

const { t } = useI18n()
const { scheme, setScheme } = useColorScheme()

const schemes = computed(() => [
  { id: "auto", label: t("settings.schemeAuto"), icon: MonitorIcon },
  { id: "light", label: t("settings.schemeLight"), icon: SunIcon },
  { id: "dark", label: t("settings.schemeDark"), icon: MoonIcon },
])
</script>
