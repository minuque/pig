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
          <span class="footer-mark" aria-hidden="true">
            <img class="footer-pig" src="/logo-pig.png" alt="" />
          </span>

          <span class="footer-name">{{ displayName }}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" :side-offset="4" variant="soft">
        <DropdownMenuItem @select.prevent="toggle">
          <component :is="currentScheme.icon" :size="14" />
          {{ t("settings.appearance") }}
          <span class="profile-value">{{ currentScheme.label }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem @select.prevent="toggleLocale">
          <EarthIcon :size="14" />
          {{ t("settings.language") }}
          <span class="profile-value">{{ currentLocale }}</span>
        </DropdownMenuItem>
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
import { Button, IconButton } from "@components/ui/button/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"
import { EarthIcon, MoonIcon, SettingsIcon, SunIcon } from "@components/icons/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"

const emit = defineEmits<{
  settings: []
}>()
const { t } = useI18n()
const { isDark, toggle } = useColorScheme()
const { locale, userName, setLocale } = useGeneralPrefs()
const displayName = computed(() => userName.value.trim() || "Pig")
/** 外观只在浅色与深色之间切；跟随系统留给设置页 */
const currentScheme = computed(() =>
  isDark.value
    ? { label: t("settings.schemeDark"), icon: MoonIcon }
    : { label: t("settings.schemeLight"), icon: SunIcon },
)
/** 语言名用它自己的写法，切到不认识的语言时也认得出 */
const currentLocale = computed(() => (locale.value === "en" ? "English" : "中文"))

function toggleLocale() {
  setLocale(locale.value === "en" ? "zh-CN" : "en")
}
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
  color: var(--contrast-foreground-muted);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

/* 名字是次级信息：常态弱一档，悬停或菜单打开时回到正文色 */
.footer-profile[data-accent-color]:hover,
.footer-profile[data-accent-color][data-state="open"] {
  color: var(--contrast-foreground);
}

/* 蓝底方块里的小猪：悬停或键盘聚焦时缩下去再探头 */
.footer-mark {
  display: block;
  flex: none;
  overflow: hidden;
  width: var(--size-avatar);
  height: var(--size-avatar);
  border-radius: var(--radius-xs);
  background: var(--brand-mark-bg);
}

.footer-pig {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 30% 100%;
}

.footer-profile:hover .footer-pig,
.footer-profile:focus-visible .footer-pig {
  animation: brand-peek var(--duration-pig-peek) both;
}

/* 当前值贴右、弱一档，像快捷键列 */
.profile-value {
  margin-inline-start: auto;
  padding-inline-start: var(--space-md);
  color: var(--contrast-foreground-faint);
}

.footer-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .footer-profile:hover .footer-pig,
  .footer-profile:focus-visible .footer-pig {
    animation: none;
  }
}
</style>
