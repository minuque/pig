<template>
  <div class="nav-head">
    <div class="nav-titlebar">
      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="nav-btn"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('nav.collapseSidebar')"
            @click="emit('toggleSidebar')"
          >
            <PanelLeftIcon class="size-icon-lg" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("nav.collapseSidebar") }}</TooltipContent>
      </Tooltip>
    </div>

    <div class="nav-toolbar">
      <Button
        class="nav-search"
        type="button"
        size="m"
        variant="ghost"
        color="neutral"
        @click="emit('update:searchOpen', true)"
      >
        <SearchIcon class="size-icon-lg" />
        <span>{{ t("nav.search") }}</span>
      </Button>

      <Popover v-model:open="scopeOpen">
        <Tooltip>
          <TooltipTrigger as-child>
            <PopoverTrigger as-child>
              <IconButton
                class="nav-btn nav-tool"
                type="button"
                size="m"
                variant="ghost"
                :aria-label="t('session.filterByWorkspace')"
              >
                <ListFilterIcon class="size-icon-lg" />
              </IconButton>
            </PopoverTrigger>
          </TooltipTrigger>

          <TooltipContent>{{ t("session.filterByWorkspace") }}</TooltipContent>
        </Tooltip>

        <ScopeMenu
          :open="scopeOpen"
          :groups="groups"
          :scope-filter="scopeFilter"
          @update:scope-filter="emit('update:scopeFilter', $event)"
          @settings="openIconDialog"
        />
      </Popover>

      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="nav-btn nav-tool"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('session.addFolder')"
            @click="emit('addProject')"
          >
            <FolderPlusIcon class="size-icon-lg" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("session.addFolder") }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="nav-btn nav-tool"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('session.newSession')"
            @click="emit('create')"
          >
            <MessageCirclePlusIcon class="size-icon-lg" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("session.newSession") }} {{ modKey }}+N</TooltipContent>
      </Tooltip>
    </div>

    <ProjectIconDialog :path="iconPath" @close="iconPath = undefined" />

    <SessionSearch
      :open="searchOpen"
      :sessions="sessions"
      @update:open="emit('update:searchOpen', $event)"
      @open="emit('open', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SessionMetadata } from "@/types/common-type.js"
import { useI18n } from "@i18n/index.js"
import { nextTick, shallowRef } from "vue"
import ProjectIconDialog from "@features/session-nav/components/ProjectIconDialog.vue"
import ScopeMenu from "@features/session-nav/components/ScopeMenu.vue"
import SessionSearch from "@features/session-nav/components/SessionSearch.vue"
import type { SessionGroup } from "@features/session-nav/type.js"
import {
  FolderPlusIcon,
  MessageCirclePlusIcon,
  SearchIcon,
  PanelLeftIcon,
  ListFilterIcon,
} from "@components/icons/index.js"
import { Button, IconButton } from "@pig/ui/button"
import { Popover, PopoverTrigger } from "@pig/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"

defineProps<{
  groups: readonly SessionGroup[]
  scopeFilter: ReadonlySet<string>
  searchOpen: boolean
  sessions: readonly SessionMetadata[]
}>()

const emit = defineEmits<{
  "update:searchOpen": [open: boolean]
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
  toggleSidebar: []
  addProject: []
  create: [cwd?: string]
  open: [id: string]
}>()
const { t } = useI18n()
const isMac = /mac/i.test(navigator.platform || navigator.userAgent)
const modKey = isMac ? "⌘" : "Ctrl"
const scopeOpen = shallowRef(false)
const iconPath = shallowRef<string>()

async function openIconDialog(canonicalPath: string): Promise<void> {
  scopeOpen.value = false
  await nextTick()
  iconPath.value = canonicalPath
}
</script>

<style scoped>
.nav-head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  padding-block: 0 var(--space-2xs);
}

.nav-titlebar {
  display: flex;
  align-items: center;
  min-width: 0;
  height: var(--header-height);
  padding-inline: var(--nav-inline);
}

.nav-btn {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

html[data-pig-desktop-platform="darwin"] .nav-titlebar {
  padding-inline-start: calc(var(--traffic-lights-width) + var(--space-xs));
}

html:is([data-pig-desktop-platform="win32"], [data-pig-desktop-platform="linux"]) .nav-titlebar {
  -webkit-app-region: drag;
  app-region: drag;
}

.nav-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  padding-inline: var(--nav-inline);
}

.nav-search {
  box-sizing: border-box;
  flex: 1;
  justify-content: flex-start;
  gap: var(--space-xs);
  min-width: 0;
  margin: 0;
  padding-inline: var(--space-xs);
  font-weight: 400;
}

.nav-tool[data-slot] {
  color: var(--fg-secondary);
  transition: color var(--duration-fast) var(--ease-out);
}

.nav-tool[data-slot]:hover,
.nav-tool[data-slot]:focus-visible,
.nav-tool[data-slot][data-open] {
  color: var(--fg);
}
</style>
