<template>
  <header class="workbench-header">
    <span class="header-start">
      <Tooltip shortcut="mod+b">
        <TooltipTrigger>
          <template #render="{ props: part }">
            <IconButton
              v-bind="part"
              class="header-toggle"
              :class="{ 'is-stowed': sbState === 'expanded' }"
              type="button"
              size="m"
              variant="ghost"
              :inert="sbState === 'expanded'"
              :aria-label="t('nav.openSidebar')"
              @click="setSbState('expanded')"
            >
              <SquarePaddingLeftIcon class="size-icon-lg" />
            </IconButton>
          </template>
        </TooltipTrigger>

        <TooltipContent>{{ t("nav.openSidebar") }}</TooltipContent>
      </Tooltip>

      <HeaderCrumbs />
    </span>

    <ViewIsland v-if="rail && sessionId" />

    <span class="header-end">
      <NotificationBell>
        <template #avatar="{ item }">
          <ProjectIcon
            v-if="item.avatar?.kind === 'project'"
            :path="item.avatar.cwd"
            fallback="monogram"
          />

          <img
            v-else-if="item.avatar?.kind === 'brand'"
            src="/pwa-icon-192.png"
            alt=""
            class="notif-brand-icon"
          />
        </template>
      </NotificationBell>

      <RailToggle v-if="rail" />
    </span>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { NotificationBell } from "@pig/ui/notification"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { IconButton } from "@pig/ui/button"
import { ProjectIcon } from "@features/session-nav/index.js"
import RailToggle from "@features/session-rail/components/RailToggle.vue"
import HeaderCrumbs from "@features/session-workbench/components/HeaderCrumbs.vue"
import ViewIsland from "@features/session-workbench/components/ViewIsland.vue"
import { useSession } from "@features/session/index.js"
import { SquarePaddingLeftIcon } from "@components/icons/index.js"

defineProps<{ rail?: boolean }>()

const { t } = useI18n()
const { sbState, setSbState } = useLeftPanelToggle()
const { sessionId } = useSession()
</script>

<style scoped>
.workbench-header {
  position: relative;
  z-index: var(--z-sticky);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: var(--header-height);
  min-height: var(--header-height);
  padding: var(--space-2xs) calc(var(--space-sm) + var(--titlebar-controls-inset)) var(--space-2xs)
    var(--space-sm);
  background: transparent;
  color: var(--fg);
}

.workbench-header.is-overlay {
  position: absolute;
  inset: 0 0 auto;
}

.header-toggle {
  overflow: hidden;
  transition:
    width var(--duration-normal) var(--ease-out),
    margin var(--duration-normal) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.header-toggle.is-stowed {
  width: 0;
  margin-inline-end: calc(-1 * var(--space-xs));
  opacity: 0;
  pointer-events: none;
}

.header-start,
.header-end {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.header-end {
  grid-column: 3;
  justify-content: flex-end;
}

.notif-brand-icon {
  inline-size: var(--icon-xl);
  block-size: var(--icon-xl);
  object-fit: cover;
}

html[data-pig-desktop-platform] .workbench-header {
  -webkit-app-region: drag;
  app-region: drag;
  user-select: none;
}

html[data-pig-desktop-platform]
  .workbench-header
  :deep(
    :is(
      button,
      a,
      input,
      select,
      textarea,
      [role="tab"],
      [role="button"],
      [role="link"],
      [data-island],
      .crumb-project-label
    )
  ) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

html[data-pig-desktop-platform="darwin"] .shell.sb-offcanvas .workbench-header {
  padding-inline-start: calc(var(--space-sm) + var(--traffic-lights-width));
}

@media (max-width: 520px) {
  .header-start > .header-toggle:not(.is-stowed) {
    width: calc(var(--control-sm) + var(--space-xs));
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-toggle {
    transition: none;
  }
}
</style>
