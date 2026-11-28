<template>
  <div class="nav-footer">
    <DropdownMenu :modal="false">
      <DropdownMenuTrigger>
        <template #render="{ props: part }">
          <Button
            v-bind="part"
            class="footer-profile"
            type="button"
            size="m"
            variant="ghost"
            color="neutral"
            :aria-label="t('nav.profileMenu')"
          >
            <img
              class="footer-logo"
              src="/pwa-icon-192.png"
              width="22"
              height="22"
              alt=""
              aria-hidden="true"
            />

            <span class="footer-name">{{ displayName }}</span>
          </Button>
        </template>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" :side-offset="4">
        <DropdownMenuItem @select.prevent="toggle">
          <component :is="currentScheme.icon" :size="14" />
          {{ t("settings.appearance") }}
          <span class="profile-value">{{ currentScheme.label }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem @select.prevent="toggleLocale">
          <GlobeIcon />
          {{ t("settings.language") }}
          <span class="profile-value">{{ currentLocale }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <IconButton
      class="footer-btn"
      type="button"
      size="m"
      variant="ghost"
      :aria-label="t('nav.settings')"
      @click="emit('settings')"
    >
      <SettingsIcon class="size-icon-lg" />
    </IconButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Button, IconButton } from "@pig/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@pig/ui/dropdown-menu"
import { useI18n } from "@i18n/index.js"
import { GlobeIcon, MoonIcon, SettingsIcon, SunIcon } from "@components/icons/index.js"
import { useGeneralPrefs } from "@features/settings/index.js"
import { useColorScheme } from "@features/theme/index.js"

const emit = defineEmits<{
  settings: []
}>()
const { t } = useI18n()
const { isDark, toggle } = useColorScheme()
const { locale, userName, setLocale } = useGeneralPrefs()
const displayName = computed(() => userName.value.trim() || "Pig")
const currentScheme = computed(() =>
  isDark.value
    ? { label: t("settings.schemeDark"), icon: MoonIcon }
    : { label: t("settings.schemeLight"), icon: SunIcon },
)
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
  gap: var(--space-2xs);
  padding: var(--space-xs) var(--nav-inline, var(--space-xs));
}

.footer-profile[data-tone] {
  flex: 1;
  justify-content: flex-start;
  gap: var(--space-xs);
  min-width: 0;
  margin: 0;
  padding-inline: var(--space-2xs) var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

.footer-profile[data-tone]:hover,
.footer-profile[data-tone][data-open] {
  color: var(--fg);
}

.footer-logo {
  display: block;
  flex: none;
  width: calc(var(--control-xs) - 2px);
  height: calc(var(--control-xs) - 2px);
  object-fit: contain;
  transition: transform var(--duration-fast) var(--ease-out);
}

.footer-profile:hover .footer-logo,
.footer-profile:focus-visible .footer-logo {
  transform: scale(1.06) rotate(-3deg);
}

.profile-value {
  margin-inline-start: auto;
  padding-inline-start: var(--space-md);
  color: var(--fg-secondary);
}

.footer-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .footer-profile:hover .footer-logo,
  .footer-profile:focus-visible .footer-logo {
    transform: none;
  }
}
</style>
