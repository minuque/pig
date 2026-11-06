<template>
  <div class="nav-footer">
    <DropdownMenu :modal="false">
      <DropdownMenuTrigger as-child>
        <Button
          class="footer-profile"
          type="button"
          size="m"
          variant="ghost"
          color="gray"
          :aria-label="t('nav.profileMenu')"
        >
          <img class="footer-logo" src="/logo.png" alt="" />
          <span class="footer-name">{{ displayName }}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" :side-offset="4" variant="soft">
        <DropdownMenuLabel>{{ t("settings.appearance") }}</DropdownMenuLabel>

        <DropdownMenuRadioGroup :model-value="scheme">
          <DropdownMenuRadioItem
            v-for="option in schemes"
            :key="option.id"
            :value="option.id"
            @select="setScheme(option.id)"
          >
            <component :is="option.icon" :size="12" />
            {{ option.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{{ t("settings.language") }}</DropdownMenuLabel>

        <DropdownMenuRadioGroup :model-value="locale">
          <DropdownMenuRadioItem
            v-for="option in locales"
            :key="option.id"
            :value="option.id"
            @select="setLocale(option.id)"
          >
            {{ option.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <Tooltip>
      <TooltipTrigger as-child>
        <IconButton
          class="footer-btn press-scale"
          type="button"
          size="m"
          variant="ghost"
          :aria-label="t('nav.settings')"
          @click="emit('settings')"
        >
          <SettingsIcon :size="16" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.settings") }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { ColorScheme } from "@/types/theme-type.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"
import { MonitorIcon, MoonIcon, SettingsIcon, SunIcon } from "@components/icons/index.js"
import { useGeneralPrefs, type UiLocale } from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"

const emit = defineEmits<{
  settings: []
}>()
const { t } = useI18n()
const { scheme, setScheme } = useColorScheme()
const { locale, userName, setLocale } = useGeneralPrefs()
const displayName = computed(() => userName.value.trim() || "Pig")
/* 文案随语言切换，必须走 computed */
const schemes = computed<{ id: ColorScheme; label: string; icon: typeof SunIcon }[]>(() => [
  { id: "auto", label: t("settings.schemeAuto"), icon: MonitorIcon },
  { id: "light", label: t("settings.schemeLight"), icon: SunIcon },
  { id: "dark", label: t("settings.schemeDark"), icon: MoonIcon },
])
const locales = computed<{ id: UiLocale; label: string }[]>(() => [
  { id: "zh-CN", label: t("settings.zhCN") },
  { id: "en", label: "English" },
])
</script>

<style scoped>
.nav-footer {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xs) var(--nav-inline, var(--space-xs));
}

/* 撑满左侧：logo 与名字靠左，长名截断。抵消 rt ghost 档的负外边距 */
.footer-profile[data-accent-color] {
  flex: 1;
  justify-content: flex-start;
  gap: var(--space-xs);
  min-width: 0;
  margin: 0;
  padding-inline: var(--space-xxs) var(--space-xs);
  color: var(--contrast-foreground);
  font-weight: var(--font-weight-medium);
}

.footer-logo {
  flex: none;
  width: var(--size-avatar);
  height: var(--size-avatar);
  border-radius: var(--radius-xs);
}

.footer-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
