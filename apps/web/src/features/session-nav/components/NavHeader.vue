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
            <PanelLeftIcon class="size-icon-2xs" />
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
        <SearchIcon class="size-icon-2xs" />
        <span>{{ t("nav.search") }}</span>
      </Button>

      <DropdownMenu v-model:open="scopeOpen" :modal="false">
        <Tooltip>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <IconButton
                class="nav-btn nav-tool"
                type="button"
                size="m"
                variant="ghost"
                :aria-label="t('session.filterByWorkspace')"
              >
                <ListFilterIcon class="size-icon-2xs" />
              </IconButton>
            </DropdownMenuTrigger>
          </TooltipTrigger>

          <TooltipContent>{{ t("session.filterByWorkspace") }}</TooltipContent>
        </Tooltip>

        <ScopeMenu
          :groups="groups"
          :scope-filter="scopeFilter"
          @update:scope-filter="emit('update:scopeFilter', $event)"
          @settings="openIconDialog"
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
            <FolderPlusIcon class="size-icon-2xs" />
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
            <MessageCirclePlusIcon class="size-icon-2xs" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("session.newSession") }} {{ modKey }}+N</TooltipContent>
      </Tooltip>
    </div>

    <ProjectIconDialog :path="iconPath" @close="iconPath = undefined" />

    <SearchDialog
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
import SearchDialog from "@features/session-nav/components/SearchDialog.vue"
import type { SessionGroup } from "@features/session-nav/type.js"
import {
  FolderPlusIcon,
  MessageCirclePlusIcon,
  SearchIcon,
  PanelLeftIcon,
  ListFilterIcon,
} from "@components/icons/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { DropdownMenu, DropdownMenuTrigger } from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

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

/** 先收起筛选菜单，再开图标弹框，免得两层焦点互抢。 */
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
  /* 上边不内缩：首行与工作台头部内元素落在同一条横线上 */
  padding-block: 0 var(--space-2xs);
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
  gap: var(--space-2xs);
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
  color: var(--fg-faint);
  transition: color var(--duration-fast) var(--ease-out);
}

.nav-tool[data-slot]:hover,
.nav-tool[data-slot]:focus-visible,
.nav-tool[data-slot][data-state="open"] {
  color: var(--fg);
}
</style>
