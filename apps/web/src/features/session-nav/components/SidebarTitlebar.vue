<template>
  <div class="nav-titlebar">
    <RouterLink to="/" class="nav-brand" aria-label="pig">
      <span class="brand-mark">
        <img class="brand-pig" src="/logo-pig.png" alt="" width="22" height="22" />
      </span>
    </RouterLink>

    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="nav-collapse"
          type="button"
          :aria-label="t('nav.collapseSidebar')"
          @click="emit('toggleSidebar')"
        >
          <SidebarGlyph :open="sbExpanded" />
        </button>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.collapseSidebar") }}</TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { SidebarGlyph } from "@components/icons/index.js"

defineProps<{
  sbExpanded: boolean
}>()

const emit = defineEmits<{
  toggleSidebar: []
}>()
const { t } = useI18n()
</script>

<style scoped>
.nav-titlebar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding-inline: var(--nav-inline);
}

.nav-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: var(--space-xxs) var(--space-xxs) var(--space-xxs) 0;
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

.nav-collapse {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
  margin-inline-start: auto;
  padding: 0;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
}

.nav-collapse:hover,
.nav-collapse:focus-visible {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

html[data-pig-desktop-platform] .nav-titlebar {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: calc(6px + var(--titlebar-inset));
  padding-inline: var(--nav-inline);
}

html[data-pig-desktop-platform="win32"] .nav-titlebar {
  height: var(--titlebar-inset);
}

html[data-pig-desktop-platform="darwin"] .nav-titlebar {
  height: var(--space-xxl);
}

@media (prefers-reduced-motion: reduce) {
  .nav-brand:hover .brand-pig,
  .nav-brand:focus-visible .brand-pig {
    animation: none;
  }
}
</style>
