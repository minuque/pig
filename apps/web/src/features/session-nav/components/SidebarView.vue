<template>
  <div class="session-nav" :class="{ 'is-scrolled': listScrolled }">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <NavHeader
      :groups="groups"
      :sort="sort"
      :scope-filter="scopeFilter"
      :search-open="searchOpen"
      :sessions="listedSessions"
      @update:search-open="emit('update:searchOpen', $event)"
      @update:scope-filter="emit('update:scopeFilter', $event)"
      @update:sort="emit('update:sort', $event)"
      @toggle-sidebar="emit('toggleSidebar')"
      @add-project="emit('addProject')"
      @create="emit('create', $event)"
      @open="emit('open', $event)"
    />

    <div class="nav-inset">
      <SessionList
        :sections="sections"
        :card-foot-by-id="cardFootById"
        :pinned-ids="pinnedIds"
        :highlighted-session-id="highlightedSessionId"
        :expanded-sections="expandedSections"
        :more-by-section="moreBySection"
        :running-since="runningSince"
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

    <NavFooter @settings="emit('settings')" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, shallowRef } from "vue"
import { useEventListener } from "@vueuse/core"
import type { SessionMetadata } from "@/types/common-type.js"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import NavHeader from "@features/session-nav/components/NavHeader.vue"
import SessionList from "@features/session-nav/components/SessionList.vue"
import type {
  SessionGroup,
  SidebarRowFoot,
  SidebarSection,
  SidebarSort,
} from "@features/session-nav/type.js"

defineProps<{
  groups: readonly SessionGroup[]
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
  runningSince: Record<string, number>
}>()

const emit = defineEmits<{
  "update:searchOpen": [open: boolean]
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
  "update:sort": [sort: SidebarSort]
  toggleSidebar: []
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
  padding-inline-start: var(--nav-inline);
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

.session-nav > .titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
  app-region: drag;
}

/* 只有 macOS 的标题条是浮层，需要页面自己撑出拖窗带 */
html[data-pig-desktop-platform="darwin"] .session-nav > .titlebar-drag {
  display: block;
}

/* 顶距 = 标题条高：侧栏首行与工作台头部落在同一条横线上 */
html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: var(--titlebar-inset);
}
</style>
