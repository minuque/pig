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
            <PanelLeftCloseIcon :size="16" />
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
        color="gray"
        @click="emit('update:searchOpen', true)"
      >
        <MagnifierIcon :size="16" />
        <span>{{ t("nav.search") }}</span>
      </Button>

      <DropdownMenu :modal="false">
        <Tooltip>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <IconButton
                class="nav-btn nav-tool"
                type="button"
                size="m"
                variant="ghost"
                :aria-label="t('session.allProjects')"
              >
                <Tuning2Icon :size="16" />
              </IconButton>
            </DropdownMenuTrigger>
          </TooltipTrigger>

          <TooltipContent>{{ t("session.allProjects") }}</TooltipContent>
        </Tooltip>

        <ScopeMenu
          :groups="groups"
          :sort="sort"
          :scope-filter="scopeFilter"
          @update:sort="emit('update:sort', $event)"
          @update:scope-filter="emit('update:scopeFilter', $event)"
        />
      </DropdownMenu>

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
            <AddFolderIcon :size="16" />
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
            <ChatRoundAddIcon :size="16" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("session.newSession") }} {{ modKey }}+N</TooltipContent>
      </Tooltip>
    </div>

    <SearchDialog
      :open="searchOpen"
      :sessions="sessions"
      :sort="sort"
      @update:open="emit('update:searchOpen', $event)"
      @open="emit('open', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SessionMetadata } from "@/types/common-type.js"
import { useI18n } from "@i18n/index.js"
import ScopeMenu from "@features/session-nav/components/ScopeMenu.vue"
import SearchDialog from "@features/session-nav/components/SearchDialog.vue"
import type { SessionGroup, SidebarSort } from "@features/session-nav/type.js"
import {
  AddFolderIcon,
  ChatRoundAddIcon,
  MagnifierIcon,
  PanelLeftCloseIcon,
  Tuning2Icon,
} from "@components/icons/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { DropdownMenu, DropdownMenuTrigger } from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

defineProps<{
  groups: readonly SessionGroup[]
  sort: SidebarSort
  scopeFilter: ReadonlySet<string>
  searchOpen: boolean
  sessions: readonly SessionMetadata[]
}>()

const emit = defineEmits<{
  "update:searchOpen": [open: boolean]
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
  "update:sort": [sort: SidebarSort]
  toggleSidebar: []
  addProject: []
  create: [cwd?: string]
  open: [id: string]
}>()
const { t } = useI18n()
const isMac = /mac/i.test(navigator.platform || navigator.userAgent)
const modKey = isMac ? "⌘" : "Ctrl"
</script>

<style scoped>
.nav-head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  /* 上边不内缩：首行与工作台头部内元素落在同一条横线上 */
  padding-block: 0 var(--space-xxs);
}

/* 首行与工作台头部同高：两栏首行共用一条横向基线 */
.nav-titlebar {
  display: flex;
  align-items: center;
  min-width: 0;
  height: var(--header-height);
  padding-inline: var(--nav-inline);
}

/* 图标按钮贴左；拖窗豁免由这一处给 */
.nav-btn {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* macOS 的红绿灯压在首行左上，收起按钮让出整簇宽度 */
html[data-pig-desktop-platform="darwin"] .nav-titlebar {
  padding-inline-start: calc(var(--size-mac-traffic-lights) + var(--space-xs));
}

/* Windows 藏起标题条，首行落进系统标题条这一行，可拖窗 */
html[data-pig-desktop-platform="win32"] .nav-titlebar {
  -webkit-app-region: drag;
  app-region: drag;
}

/* t3code 式工具行：搜索占满左侧，视图与命令图标靠右 */
.nav-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  padding-inline: var(--nav-inline);
}

/* 抵消 rt ghost 档的负外边距，让搜索撑开剩余宽度 */
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

/* 工具行图标常态弱一档，悬停、聚焦或菜单打开时回到正文色 */
.nav-tool[data-slot] {
  color: var(--contrast-foreground-faint);
  transition: color var(--duration-fast) var(--ease-hover);
}

.nav-tool[data-slot]:hover,
.nav-tool[data-slot]:focus-visible,
.nav-tool[data-slot][data-state="open"] {
  color: var(--contrast-foreground);
}
</style>
