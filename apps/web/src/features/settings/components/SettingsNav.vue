<template>
  <div class="settings-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-head">
      <RouterLink to="/" class="nav-brand" aria-label="pig">
        <span class="brand-mark">
          <img class="brand-pig" src="/logo-pig.png" alt="" width="22" height="22" />
        </span>

        <span class="brand-word" aria-hidden="true">pig</span>
      </RouterLink>
    </div>

    <nav class="nav-inset" :aria-label="t('settings.title')">
      <RouterLink v-for="item in tabs" :key="item.id" :to="{ name: item.route }" class="nav-item">
        <component :is="item.icon" class="size-icon" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <div class="nav-footer">
      <button class="footer-back press-scale" type="button" @click="goBack">
        <span class="footer-glyph">
          <ArrowLeftIcon />
        </span>

        <span>{{ t("common.back") }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRouter } from "vue-router"
import { useI18n } from "@i18n/index.js"
import {
  ArrowLeftIcon,
  ChartSquareIcon,
  SliderMinimalisticHorizontalIcon,
  Widget5Icon,
  WidgetAddIcon,
} from "@components/icons/index.js"

type SettingsRoute =
  "settings-general" | "settings-usage" | "settings-skills" | "settings-extensions"

const { t } = useI18n()
const router = useRouter()
const tabs = computed<
  {
    id: string
    route: SettingsRoute
    label: string
    icon: typeof SliderMinimalisticHorizontalIcon
  }[]
>(() => [
  {
    id: "general",
    route: "settings-general",
    label: t("settings.general"),
    icon: SliderMinimalisticHorizontalIcon,
  },
  { id: "usage", route: "settings-usage", label: t("settings.usage"), icon: ChartSquareIcon },
  { id: "skills", route: "settings-skills", label: t("settings.skills"), icon: WidgetAddIcon },
  {
    id: "extensions",
    route: "settings-extensions",
    label: t("settings.extensions"),
    icon: Widget5Icon,
  },
])

function goBack() {
  // 返回固定回会话页，不走历史后退，避免停在设置的上一个 tab。
  void router.push("/")
}
</script>

<style scoped>
.settings-nav {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  user-select: none;
}

.nav-inset {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding-block-start: var(--spacing-xxs);
  padding-inline: var(--spacing-xs);
}

.nav-head {
  display: flex;
  flex: none;
  align-items: center;
  min-width: 0;
  padding-inline: var(--spacing-xs);
}

.nav-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  margin-inline-start: calc(-1 * var(--spacing-xxs));
  padding: var(--spacing-xxs);
  border-radius: var(--radius-md);
  color: var(--contrast-foreground);
  text-decoration: none;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.nav-brand:hover,
.nav-brand:focus-visible {
  background: var(--interaction-hover);
}

.brand-mark {
  display: block;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--brand-mark-bg);
}

.brand-pig {
  display: block;
  transform-origin: 30% 100%;
}

.nav-brand:hover .brand-pig,
.nav-brand:focus-visible .brand-pig {
  animation: brand-peek var(--duration-pig-peek) both;
}

.brand-word {
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: var(--text-title);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: start;
  text-decoration: none;
  transition: background-color var(--duration-fast) var(--ease-hover);
}

.nav-item:hover {
  background: var(--interaction-hover);
}

.nav-item.router-link-active {
  background: var(--interaction-selected);
}

.nav-footer {
  display: flex;
  flex: none;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-xs);
  border-top: var(--border-width) solid var(--border-subtle);
}

.footer-back {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: start;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}

.footer-back:hover {
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
}

.footer-glyph {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
}

.titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .titlebar-drag {
  display: block;
}

html[data-pig-desktop-platform] .settings-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}

html[data-pig-desktop-platform] .nav-head {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: calc(6px + var(--titlebar-inset));
  padding-inline: var(--spacing-xs);
}

html[data-pig-desktop-platform="win32"] .settings-nav {
  padding-top: var(--titlebar-inset);
}

html[data-pig-desktop-platform="win32"] .nav-head {
  height: var(--titlebar-inset);
}

html[data-pig-desktop-platform="darwin"] .settings-nav {
  padding-top: var(--spacing-xxl);
}

html[data-pig-desktop-platform="darwin"] .nav-head {
  height: var(--spacing-xxl);
}

@media (max-width: 900px) {
  .nav-inset,
  .nav-footer {
    padding-inline: var(--spacing-md);
  }
}

@media (prefers-reduced-motion: reduce) {
  .footer-back,
  .nav-item {
    transition: none;
  }

  .nav-brand:hover .brand-pig,
  .nav-brand:focus-visible .brand-pig {
    animation: none;
  }
}
</style>
