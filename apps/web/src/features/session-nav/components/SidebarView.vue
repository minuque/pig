<template>
  <div class="session-nav" :class="{ 'is-scrolled': listScrolled }">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-head">
      <SidebarTitlebar
        @toggle-sidebar="emit('toggleSidebar')"
        @create="emit('create')"
        @home="emit('home')"
      />

      <SearchDialog
        :open="searchOpen"
        :sessions="listedSessions"
        :sort="sort"
        @update:open="emit('update:searchOpen', $event)"
        @open="emit('open', $event)"
      />
    </div>

    <div class="nav-inset">
      <p v-if="connected && !groups.length" class="add-guide">
        <ArrowUpIcon class="size-icon motion-nudge" />
        {{ t("session.addGuide") }}
      </p>

      <SessionList
        :sections="sections"
        :filtered="scopeFilter.size > 0"
        :card-foot-by-id="cardFootById"
        :pinned-ids="pinnedIds"
        :highlighted-session-id="highlightedSessionId"
        :expanded-sections="expandedSections"
        :more-by-section="moreBySection"
        @navigate="emit('navigate', $event)"
        @open="emit('open', $event)"
        @prime="emit('prime', $event)"
        @toggle-pinned="emit('togglePinned', $event)"
        @rename="(id, name) => emit('rename', id, name)"
        @delete="emit('delete', $event)"
        @settle="emit('settle', $event)"
        @unsettle="emit('unsettle', $event)"
        @reorder-pinned="(id, toIndex) => emit('reorderPinned', id, toIndex)"
        @pin-at="(id, toIndex) => emit('pinAt', id, toIndex)"
        @unpin="emit('unpin', $event)"
        @toggle-section="emit('toggleSection', $event)"
        @reveal-more="emit('revealMore', $event)"
        @collapse-group="emit('collapseGroup', $event)"
      />
    </div>

    <NavFooter
      :counts="statusCounts"
      @settings="emit('settings')"
      @search="emit('update:searchOpen', true)"
      @add-project="emit('addProject')"
      @cycle="emit('cycleStatus', $event)"
    >
      <template #extra>
        <div class="filter-anchor">
          <IconButton
            class="filter-btn"
            type="button"
            size="m"
            variant="ghost"
            :title="t('session.allProjects')"
            @click.stop="scopeMenuOpen = !scopeMenuOpen"
          >
            <Tuning2Icon :size="15" />
          </IconButton>

          <ScopeMenu
            v-if="scopeMenuOpen"
            placement="above"
            :groups="groups"
            :sort="sort"
            :scope-filter="scopeFilter"
            @update:sort="emit('update:sort', $event)"
            @update:scope-filter="emit('update:scopeFilter', $event)"
            @settings="onGlobalSettings"
          />
        </div>
      </template>
    </NavFooter>
  </div>
</template>

<script setup lang="ts">
import { onMounted, shallowRef } from "vue"
import { useEventListener } from "@vueuse/core"
import type { SessionMetadata } from "@/types/common-type.js"
import { useI18n } from "@i18n/index.js"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import SearchDialog from "@features/session-nav/components/SearchDialog.vue"
import SidebarTitlebar from "@features/session-nav/components/SidebarTitlebar.vue"
import ScopeMenu from "@features/session-nav/components/ScopeMenu.vue"
import SessionList from "@features/session-nav/components/SessionList.vue"
import type {
  SessionGroup,
  SidebarRowFoot,
  SidebarSection,
  SidebarSort,
} from "@features/session-nav/type.js"
import type { FooterStatus } from "@features/session-nav/lib/status-cycle.js"
import { ArrowUpIcon, Tuning2Icon } from "@components/icons/index.js"
import { IconButton } from "@components/ui/button/index.js"

defineProps<{
  groups: readonly SessionGroup[]
  connected: boolean
  sort: SidebarSort
  scopeFilter: ReadonlySet<string>
  searchOpen: boolean
  sections: readonly SidebarSection[]
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  listedSessions: readonly SessionMetadata[]
  pinnedIds: ReadonlySet<string>
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  moreBySection: Record<string, number>
  statusCounts: Record<FooterStatus, number>
}>()

const emit = defineEmits<{
  "update:searchOpen": [open: boolean]
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
  "update:sort": [sort: SidebarSort]
  toggleSidebar: []
  home: []
  cycleStatus: [status: FooterStatus]
  create: [cwd?: string]
  addProject: []
  settings: []
  navigate: [cwd: string | undefined]
  open: [id: string]
  prime: [id: string]
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
  settle: [id: string]
  unsettle: [id: string]
  reorderPinned: [id: string, toIndex: number]
  pinAt: [id: string, toIndex: number]
  unpin: [id: string]
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
}>()
const { t } = useI18n()
const scopeMenuOpen = shallowRef(false)
const listScrolled = shallowRef(false)

function updateListScrolled() {
  const el = document.querySelector<HTMLElement>(".session-window")

  listScrolled.value = !!el && el.scrollTop > 0
}

onMounted(() => {
  updateListScrolled()
})

// scroll 不冒泡，要走 window 的捕获阶段才能兜到 .session-window 自己的滚动。
useEventListener(window, "scroll", updateListScrolled, { passive: true, capture: true })

useEventListener(window, "pointerdown", (event) => {
  if (!scopeMenuOpen.value) return
  const target = event.target

  if (target instanceof Element && target.closest(".scope-menu, .filter-btn")) return
  scopeMenuOpen.value = false
})

function onGlobalSettings(): void {
  emit("settings")
  scopeMenuOpen.value = false
}
</script>

<style scoped>
.session-nav {
  --nav-inline: var(--space-xs);
  position: relative;
  isolation: isolate;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  user-select: none;
}

.nav-inset {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding-block-start: var(--space-xxs);
  padding-inline-start: var(--nav-inline);
}

/* 横向内边距交给子元素：header 自己带就会把底边线切成中间一截。
   这里也不能加 position：桌面壳的 .nav-titlebar 靠 .session-nav 定位贴顶。 */
.nav-head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  padding-block: var(--space-xxs);
}

/* 渐隐带挂在滚动区顶上，和分隔线一起出现：内容滚出视口才显示。 */
.nav-inset::before {
  content: "";
  position: absolute;
  z-index: 1;
  inset-inline: var(--nav-inline);
  top: 0;
  height: var(--edge-fade-band);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
  background: linear-gradient(to bottom, var(--background), transparent);
  pointer-events: none;
}

.session-nav.is-scrolled .nav-inset::before {
  opacity: 1;
}

/* 筛选按钮挂在页脚；菜单以页脚为定位基准，朝上展开 */
.filter-anchor {
  display: flex;
}

.session-nav > .titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: calc(var(--workbench-inset) + var(--titlebar-inset));
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .session-nav > .titlebar-drag {
  display: block;
}

/* Linux 走原生边框，没有可自拖的标题条 */
html[data-pig-desktop-platform="linux"] .session-nav > .titlebar-drag {
  display: none;
}

/* 顶距 = 卡片内缩 + 标题条：侧栏首行与卡片头落在同一条横线上 */
html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(var(--workbench-inset) + var(--titlebar-inset));
}

.add-guide {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xxs);
  margin: 0;
  padding-block: var(--space-xxs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.add-guide .motion-nudge {
  margin-inline-start: var(--space-xs);
}
</style>
