<template>
  <div class="session-nav" :class="{ 'is-scrolled': listScrolled }">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-head">
      <SidebarTitlebar :sb-expanded="sbExpanded" @toggle-sidebar="emit('toggleSidebar')" />

      <div class="search-head">
        <button class="search-field press-scale" type="button" @click="emit('create')">
          <span class="search-field-lead"><ChatRoundAddIcon :size="15" /></span>
          <span class="search-field-label">{{ t("session.newSession") }}</span>
        </button>

        <div class="head-actions">
          <button
            class="head-btn"
            type="button"
            :title="t('nav.search')"
            @click="emit('update:searchOpen', true)"
          >
            <MagnifierIcon :size="15" />
          </button>

          <button
            class="head-btn"
            :class="{ scoped: !!scopeFilter }"
            type="button"
            :title="t('session.allProjects')"
            @click.stop="scopeMenuOpen = !scopeMenuOpen"
          >
            <Tuning2Icon :size="15" />
          </button>

          <button
            class="head-btn"
            type="button"
            :title="t('session.addGuide')"
            @click="emit('addProject')"
          >
            <AddFolderIcon :size="15" />
          </button>
        </div>

        <SearchDialog
          :open="searchOpen"
          :sessions="listedSessions"
          :sort="sort"
          @update:open="emit('update:searchOpen', $event)"
          @open="emit('open', $event)"
        />

        <ScopeMenu
          v-if="scopeMenuOpen"
          :groups="groups"
          :grouping="grouping"
          :sort="sort"
          :scope-filter="scopeFilter"
          @update:grouping="emit('update:grouping', $event)"
          @update:sort="emit('update:sort', $event)"
          @update:scope-filter="pickScope"
          @settings="onGlobalSettings"
          @edit-project="onEditProject"
        />
      </div>
    </div>

    <div class="nav-inset">
      <p v-if="connected && !groups.length" class="add-guide">
        <ArrowUpIcon class="size-icon motion-nudge" />
        {{ t("session.addGuide") }}
      </p>

      <SessionList
        :sections="sections"
        :scope-filter="scopeFilter"
        :card-foot-by-id="cardFootById"
        :pinned-ids="pinnedIds"
        :highlighted-session-id="highlightedSessionId"
        :expanded-sections="expandedSections"
        :expanded-by-group="expandedByGroup"
        @navigate="emit('navigate', $event)"
        @open="emit('open', $event)"
        @prime="emit('prime', $event)"
        @create="emit('create', $event)"
        @toggle-pinned="emit('togglePinned', $event)"
        @rename="(id, name) => emit('rename', id, name)"
        @delete="emit('delete', $event)"
        @reorder-pinned="(id, toIndex) => emit('reorderPinned', id, toIndex)"
        @toggle-section="emit('toggleSection', $event)"
        @reveal-more="emit('revealMore', $event)"
        @collapse-group="emit('collapseGroup', $event)"
      />
    </div>

    <NavFooter @settings="emit('settings')" />

    <ProjectSettingsDialog
      v-if="projectSettingsOpen"
      v-model:open="projectSettingsOpen"
      :project="projectSettingsTarget"
    />
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
import ProjectSettingsDialog from "@features/session-nav/components/ProjectSettingsDialog.vue"
import type {
  SessionGroup,
  SidebarGrouping,
  SidebarRowFoot,
  SidebarSection,
  SidebarSort,
} from "@features/session-nav/type.js"
import {
  AddFolderIcon,
  ArrowUpIcon,
  ChatRoundAddIcon,
  MagnifierIcon,
  Tuning2Icon,
} from "@components/icons/index.js"

defineProps<{
  groups: readonly SessionGroup[]
  connected: boolean
  sbExpanded: boolean
  grouping: SidebarGrouping
  sort: SidebarSort
  scopeFilter: string | undefined
  searchOpen: boolean
  sections: readonly SidebarSection[]
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  listedSessions: readonly SessionMetadata[]
  pinnedIds: ReadonlySet<string>
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  expandedByGroup: Record<string, number>
}>()

const emit = defineEmits<{
  "update:searchOpen": [open: boolean]
  "update:scopeFilter": [name: string | undefined]
  "update:grouping": [grouping: SidebarGrouping]
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
  reorderPinned: [id: string, toIndex: number]
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
}>()
const { t } = useI18n()
const scopeMenuOpen = shallowRef(false)
const listScrolled = shallowRef(false)
const projectSettingsOpen = shallowRef(false)
const projectSettingsTarget = shallowRef("")

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

  if (target instanceof Element && target.closest(".scope-menu, .head-btn")) return
  scopeMenuOpen.value = false
})

function pickScope(name: string | undefined): void {
  emit("update:scopeFilter", name)
  scopeMenuOpen.value = false
}

function onGlobalSettings(): void {
  emit("settings")
  scopeMenuOpen.value = false
}

function onEditProject(project: string): void {
  projectSettingsTarget.value = project
  projectSettingsOpen.value = true
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
  border-bottom: var(--border-width) solid transparent;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.session-nav.is-scrolled .nav-head {
  border-bottom-color: var(--border-subtle);
}

.search-head {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  padding-inline: var(--nav-inline);
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
  background: linear-gradient(to bottom, var(--sidebar), transparent);
  pointer-events: none;
}

.session-nav.is-scrolled .nav-inset::before {
  opacity: 1;
}

.search-field {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  height: 32px;
  padding-inline: var(--space-xxs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  text-align: start;
  cursor: pointer;
}

.search-field:hover,
.search-field:focus-visible {
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
}

.search-field-lead {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
}

.search-field-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-actions {
  display: flex;
  flex: none;
  align-items: center;
}

.head-btn {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
}

.head-btn:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.head-btn.scoped {
  color: var(--primary);
}

.head-btn.scoped::after {
  content: "";
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--primary);
  translate: -50% 0;
}

.session-nav > .titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .session-nav > .titlebar-drag {
  display: block;
}

html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}

html[data-pig-desktop-platform="win32"] .session-nav {
  padding-top: var(--titlebar-inset);
}

html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: var(--space-xxl);
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

@media (prefers-reduced-motion: reduce) {
  .search-field {
    transition: none;
  }
}
</style>
