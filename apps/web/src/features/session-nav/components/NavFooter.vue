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

      <DropdownMenuContent side="top" align="start" :side-offset="4" bare>
        <div class="profile-panel">
          <SegmentedControl
            :model-value="scheme"
            size="s"
            :aria-label="t('settings.appearance')"
            @update:model-value="setScheme($event as ColorScheme)"
          >
            <SegmentedControlItem
              v-for="option in schemes"
              :key="option.id"
              :value="option.id"
              :aria-label="option.label"
              :title="option.label"
            >
              <component :is="option.icon" :size="14" />
            </SegmentedControlItem>
          </SegmentedControl>

          <SegmentedControl
            :model-value="locale"
            size="s"
            :aria-label="t('settings.language')"
            @update:model-value="setLocale($event as UiLocale)"
          >
            <SegmentedControlItem v-for="option in locales" :key="option.id" :value="option.id">
              {{ option.label }}
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
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
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { SegmentedControl, SegmentedControlItem } from "@components/ui/segmented-control/index.js"
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
  { id: "zh-CN", label: "中文" },
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

/* 两组切换并排成两行，等宽铺满 */
.profile-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-xs);
}

.profile-panel > [data-slot="segmented-control"] {
  width: 100%;
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
