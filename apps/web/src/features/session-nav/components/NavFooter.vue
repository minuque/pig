<template>
  <div class="nav-footer">
    <button class="footer-settings press-scale" type="button" @click="emit('settings')">
      <span class="footer-glyph">
        <SettingsIcon />
      </span>

      <span>{{ t("nav.settings") }}</span>
    </button>

    <DropdownMenu :modal="false">
      <Tooltip>
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <button class="footer-help press-scale" type="button" :aria-label="t('nav.help')">
              <QuestionCircleIcon />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>

        <TooltipContent>{{ t("nav.help") }}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent side="top" align="end" :side-offset="8">
        <DropdownMenuItem class="help-item" @select.prevent="toggleSound()">
          <span class="help-lead">
            <VolumeLoudIcon v-if="soundOn" />
            <VolumeCrossIcon v-else />
            {{ t("nav.sound") }}
          </span>

          <span class="help-state">{{ soundOn ? t("common.on") : t("common.off") }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem class="help-item" @select.prevent="toggleTheme()">
          <span class="help-lead">
            <MoonIcon v-if="isDark" />
            <SunIcon v-else />
            {{ t("nav.theme") }}
          </span>

          <span class="help-state">{{ isDark ? t("nav.themeDark") : t("nav.themeLight") }}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem class="help-item" as-child>
          <a href="https://github.com/minuque/pig" target="_blank" rel="noopener noreferrer">
            <span class="help-lead">
              <Book2Icon />
              {{ t("nav.docs") }}
            </span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"
import { useSound } from "@features/click-sound/index.js"
import { useColorScheme } from "@features/theme/index.js"
import {
  Book2Icon,
  MoonIcon,
  QuestionCircleIcon,
  SettingsIcon,
  SunIcon,
  VolumeCrossIcon,
  VolumeLoudIcon,
} from "@components/icons/index.js"

const emit = defineEmits<{
  settings: []
}>()
const { t } = useI18n()
const { enabled: soundOn, toggle: toggleSound } = useSound()
const { isDark, toggle: toggleTheme } = useColorScheme()
</script>

<style scoped>
.nav-footer {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--nav-inline, var(--spacing-xs));
  border-top: var(--border-width) solid var(--border-subtle);
}

.footer-settings,
.footer-help {
  border: 0;
  background: transparent;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}

.footer-settings:hover {
  background: var(--interaction-hover);
  color: var(--ink);
}

.footer-help:hover,
.footer-help[data-state="open"] {
  background: var(--hover-quiet);
  color: var(--ink);
}

.footer-settings {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
}

/* 前置图标槽，和会话行的 icon 列对齐 */
.footer-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
}

.footer-glyph svg,
.footer-help svg {
  width: var(--size-icon);
  height: var(--size-icon);
}

.footer-help {
  display: grid;
  flex: none;
  place-items: center;
  padding: var(--icon-button-pad);
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
}

@media (prefers-reduced-motion: reduce) {
  .footer-settings,
  .footer-help {
    transition: none;
  }
}
</style>

<style>
/* 菜单经 Portal 挂到 body，scoped 选不中 */
.help-item svg {
  width: var(--size-icon-2xs);
  height: var(--size-icon-2xs);
}

.help-lead {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.help-state {
  margin-inline-start: auto;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
