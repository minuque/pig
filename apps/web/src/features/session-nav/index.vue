<template>
  <div class="session-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-card">
      <div class="nav-inset">
        <div class="logo-row">
          <RouterLink to="/" class="logo-mark">
            <img src="/pwa-icon-192.png" alt="" width="22" height="22" />
          </RouterLink>

          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="collapse-toggle"
                type="button"
                aria-label="折叠侧边栏"
                @click="emit('toggle')"
              >
                <PanelLeft class="size-icon" />
              </button>
            </TooltipTrigger>

            <TooltipContent>折叠侧边栏</TooltipContent>
          </Tooltip>
        </div>

        <div class="nav-main">
          <NavToolbar @create="onCreateSession" @search="openSearch" />

          <div class="nav-body">
            <nav class="session-list">
              <section v-if="pinnedRows.length" class="nav-section">
                <div class="section-label">
                  <span class="section-label-text">置顶</span>

                  <button
                    class="section-fold"
                    type="button"
                    :aria-expanded="!collapsedSections.pinned"
                    :aria-label="collapsedSections.pinned ? '展开置顶' : '折叠置顶'"
                    @click="collapsedSections.pinned = !collapsedSections.pinned"
                  >
                    <ChevronDown v-if="!collapsedSections.pinned" class="size-icon" />
                    <ChevronRight v-else class="size-icon" />
                  </button>
                </div>

                <div v-if="!collapsedSections.pinned" class="group-body">
                  <SessionItem
                    v-for="session in pinnedRows"
                    :key="session.id"
                    :session="session"
                    :active="session.id === highlightedSessionId"
                    :pinned="true"
                    :show-path="true"
                    :state="sessionState(session.id)"
                    :now="now"
                    @navigate="onSessionNavigate(session.cwd)"
                    @toggle-pinned="togglePinned"
                    @rename="renameSession"
                    @delete="deleteSession"
                  />
                </div>
              </section>

              <SessionsHead
                v-if="connected || groups.length"
                :view="view"
                :sort="sort"
                :all-collapsed="allCollapsed"
                :can-fold="view === 'grouped' && groupRows.length > 0"
                @toggle-all="toggleAllGroups"
                @set-view="setView"
                @set-sort="setSort"
              />

              <ul v-if="view === 'flat' && updatedSessions.length" class="flat-sessions">
                <li v-for="session in updatedSessions" :key="session.id">
                  <SessionItem
                    :session="session"
                    :active="session.id === highlightedSessionId"
                    :pinned="pinnedIds.has(session.id)"
                    :state="sessionState(session.id)"
                    :now="now"
                    @navigate="onSessionNavigate(session.cwd)"
                    @toggle-pinned="togglePinned"
                    @rename="renameSession"
                    @delete="deleteSession"
                  />
                </li>

                <li v-if="hasMore">
                  <button class="more-button" type="button" @click="bumpGroup('updated')">
                    显示更多
                  </button>
                </li>
              </ul>

              <ul v-else-if="view === 'grouped' && showList">
                <li
                  v-for="section in listSections"
                  :key="section.key"
                  :class="[
                    section.rowClass,
                    {
                      'is-open': section.open,
                      'is-manual': sort === 'manual',
                      'drop-before': dropLine?.key === section.key && dropLine.place === 'before',
                      'drop-after': dropLine?.key === section.key && dropLine.place === 'after',
                    },
                  ]"
                  @dragover.prevent="onGroupDragOver(section.key, $event)"
                  @drop.prevent="onGroupDrop(section.key)"
                  @dragend="clearGroupDrag"
                >
                  <GroupHead
                    :name="section.name"
                    :kind="section.kind"
                    :sortable="sort === 'manual'"
                    :collapsed="section.collapsed"
                    @dragstart="onGroupDragStart(section.key, $event)"
                    @toggle="section.toggle"
                    @create="section.create?.()"
                  />

                  <div
                    v-if="section.sessions.length > 0 || section.more"
                    class="session-list-group"
                    :class="{ 'is-open': !section.collapsed }"
                  >
                    <div class="group-body">
                      <SessionItem
                        v-for="session in section.sessions"
                        :key="session.id"
                        :session="session"
                        :active="session.id === highlightedSessionId"
                        :pinned="pinnedIds.has(session.id)"
                        :state="sessionState(session.id)"
                        :now="now"
                        @navigate="onSessionNavigate(session.cwd)"
                        @toggle-pinned="togglePinned"
                        @rename="renameSession"
                        @delete="deleteSession"
                      />

                      <button
                        v-if="section.more"
                        class="more-button"
                        type="button"
                        @click="section.bump"
                      >
                        显示更多
                      </button>
                    </div>
                  </div>
                </li>
              </ul>

              <span v-else-if="groups.length">暂无会话</span>
            </nav>
          </div>

          <p v-if="connected && !groups.length" class="add-guide">
            点击添加工作目录
            <ArrowDown class="size-icon motion-nudge" />
          </p>
        </div>
      </div>

      <NavFooter
        :label="footerLabel"
        :can-add="footerCanAdd"
        :adding-workspace="addingWorkspace"
        @add-workspace="addWorkspace"
        @settings="openSettings"
      />
    </div>

    <SessionSearch v-if="searchOpen" v-model:open="searchOpen" @navigate="onSessionNavigate" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, shallowRef, watch } from "vue"
import { useEventListener, useTimestamp } from "@vueuse/core"
import { RouterLink, useRouter } from "vue-router"
import { ArrowDown, ChevronDown, ChevronRight, PanelLeft } from "@lucide/vue"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { notifyError } from "@components/layout/notify.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import NavToolbar from "@features/session-nav/components/NavToolbar.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionsHead from "@features/session-nav/components/SessionsHead.vue"
import { toSidebarSession } from "@features/session-nav/lib/session-list.js"
import { useSettings } from "@features/settings/index.js"
import type { SidebarRow, SidebarSessionState } from "@features/session-nav/type.js"

const SessionSearch = defineAsyncComponent(
  () => import("@features/session-nav/components/SessionSearch.vue"),
)
const emit = defineEmits<{
  navigate: [canonicalPath: string]
  toggle: []
}>()
const {
  groups,
  cardFootById,
  view,
  sort,
  setView,
  setSort,
  reorderGroups,
  bumpGroup,
  toggleGroup,
  setGroupsCollapsed,
  rowsFor,
  pinnedIds,
  pinnedSessions,
  togglePinned,
  addingWorkspace,
  connected,
  lastCwd,
  highlightedSessionId,
  cancelPendingOpen,
  navError: workspaceError,
  addWorkspace,
  renameSession,
  deleteSession,
} = useNav()
const { openSettings } = useSettings()
const router = useRouter()
const searchOpen = shallowRef(false)

onMounted(() => {
  const prefetch = () => {
    void import("@features/session-nav/components/SessionSearch.vue")
  }

  if (typeof requestIdleCallback === "function") requestIdleCallback(prefetch)
  else setTimeout(prefetch, 1)
})

const now = useTimestamp({ interval: 60_000 })
const collapsedSections = reactive({ pinned: false })
const dragGroupKey = shallowRef<string | null>(null)
const dropLine = shallowRef<{ key: string; place: "before" | "after" } | null>(null)
const rows = rowsFor(false)
const showList = computed(() => rows.value.some((row) => row.kind !== "more"))
const groupRows = computed(() =>
  rows.value.filter((row): row is Extract<SidebarRow, { kind: "group" }> => row.kind === "group"),
)
const updatedSessions = computed(() =>
  rows.value.flatMap((row) => (row.kind === "session" ? [row.session] : [])),
)
const hasMore = computed(() => rows.value.some((row) => row.kind === "more"))
const pinnedRows = computed(() => pinnedSessions.value.map(toSidebarSession))

function highlightedCwd(): string | undefined {
  const id = highlightedSessionId.value

  if (!id) return undefined

  const pinned = pinnedRows.value.find((session) => session.id === id)

  if (pinned?.cwd) return canonicalizeWorkspacePath(pinned.cwd)

  for (const group of groups.value) {
    if (group.sessions.some((session) => session.id === id)) return group.canonicalPath
  }

  return undefined
}

const activeDirectory = computed(() =>
  highlightedSessionId.value ? highlightedCwd() : lastCwd.value,
)
const footerLabel = computed(() => {
  const path = activeDirectory.value ?? lastCwd.value
  return path ? workspaceName(path) : "添加工作目录"
})
const footerCanAdd = computed(() => !(activeDirectory.value ?? lastCwd.value))
const listSections = computed(() =>
  groupRows.value.map((row) => ({
    key: row.key,
    rowClass: "row-group",
    name: workspaceName(row.canonicalPath),
    kind: "directory" as const,
    collapsed: row.collapsed,
    open: !row.collapsed && (row.sessions.length > 0 || row.more),
    sessions: row.sessions,
    more: row.more,
    bump: () => bumpGroup(row.key),
    toggle: () => toggleGroup(row.canonicalPath),
    create: () => onCreateInDir(row.canonicalPath),
  })),
)
const allCollapsed = computed(
  () => groupRows.value.length > 0 && groupRows.value.every((row) => row.collapsed),
)

function toggleAllGroups() {
  setGroupsCollapsed(!allCollapsed.value)
}

function clearGroupDrag() {
  dragGroupKey.value = null
  dropLine.value = null
}

function onGroupDragStart(key: string, event: DragEvent) {
  dragGroupKey.value = key
  dropLine.value = null
  event.dataTransfer?.setData("text/plain", key)

  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
}

function onGroupDragOver(key: string, event: DragEvent) {
  const from = dragGroupKey.value

  if (!from || from === key) {
    dropLine.value = null
    return
  }

  const row = event.currentTarget

  if (!(row instanceof HTMLElement)) return
  const rect = row.getBoundingClientRect()
  const place = event.clientY < rect.top + rect.height / 2 ? "before" : "after"

  if (dropLine.value?.key === key && dropLine.value.place === place) return
  dropLine.value = { key, place }
}

function onGroupDrop(key: string) {
  const from = dragGroupKey.value
  const place = dropLine.value?.key === key ? dropLine.value.place : "before"
  clearGroupDrag()

  if (!from || from === key) return
  const paths = groupRows.value.map((row) => row.canonicalPath)
  const next = paths.filter((path) => path !== from)
  let index = next.indexOf(key)

  if (index < 0) return

  if (place === "after") index += 1
  next.splice(index, 0, from)
  reorderGroups(next)
}

function openSearch() {
  void import("@features/session-nav/components/SessionSearch.vue")
  searchOpen.value = true
}

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return
  event.preventDefault()
  openSearch()
})

watch(workspaceError, (message) => {
  const text = message.trim()

  if (text) notifyError(text)
})

function sessionState(id: string): SidebarSessionState | undefined {
  return cardFootById.value.get(id)?.state
}

function onSessionNavigate(cwd: string | undefined): void {
  if (cwd) emit("navigate", cwd)
}

function onCreateInDir(canonicalPath: string): void {
  cancelPendingOpen()
  emit("navigate", canonicalPath)
  void router.push("/")
}

function onCreateSession(): void {
  const path = highlightedCwd() ?? lastCwd.value ?? groups.value[0]?.canonicalPath

  if (path) onCreateInDir(path)
  else void addWorkspace()
}
</script>

<style scoped>
.session-nav {
  --nav-inline: var(--spacing-xs);
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  user-select: none;
}

.nav-card {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: transparent;
}

.nav-inset {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: inherit;
  padding-inline: var(--nav-inline);
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

html[data-pig-desktop-platform="win32"] .session-nav > .titlebar-drag {
  display: none;
}

html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}

html[data-pig-desktop-platform="win32"] .session-nav {
  padding-top: var(--spacing-xs);
}

html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: var(--spacing-xxl);
}

html[data-pig-desktop-platform] .logo-row {
  background: var(--sidebar);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .logo-row :is(button, a) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.logo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--size-nav-rail);
}

html[data-pig-desktop-platform="win32"] .logo-row {
  min-height: var(--titlebar-inset);
}

.logo-mark,
.collapse-toggle {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}

.logo-mark {
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
}

.logo-mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

:is(.logo-mark, .collapse-toggle):hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.nav-main,
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.nav-main {
  gap: var(--spacing-xs);
}

.nav-body {
  overflow: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.session-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.nav-body::-webkit-scrollbar {
  display: none;
}

.session-list ul {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-section,
.row-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.row-group.is-manual .group-head {
  cursor: grab;
}

.row-group.drop-before,
.row-group.drop-after {
  position: relative;
}

.row-group.drop-before::before,
.row-group.drop-after::after {
  content: "";
  position: absolute;
  z-index: 1;
  right: var(--spacing-xs);
  left: var(--spacing-xs);
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--primary);
  pointer-events: none;
}

.row-group.drop-before::before {
  top: calc(var(--spacing-xs) / -2);
}

.row-group.drop-after::after {
  bottom: calc(var(--spacing-xs) / -2);
}

.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  min-height: var(--size-icon-button);
  padding-inline: var(--spacing-xs);
}

.section-label-text {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-fold {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon);
  height: var(--size-icon);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}

.section-fold:hover,
.section-fold:focus-visible {
  color: var(--ink);
}

@media (hover: hover) {
  .section-fold {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .section-label:is(:hover, :focus-within) .section-fold,
  .section-fold:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-block-start: var(--spacing-xxs);
}

.more-button {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--size-scroll-control);
  padding-inline: calc(var(--spacing-xs) + var(--size-icon) + var(--spacing-xxs)) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
}

.more-button:hover,
.more-button:focus-visible {
  color: var(--ink);
}

.add-guide {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xxs);
  margin: 0;
  padding-block: var(--spacing-xxs);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
}

.add-guide .motion-nudge {
  margin-inline-start: calc((var(--size-icon-button) - var(--size-icon)) / 2);
}

@media (max-width: 900px) {
  .session-nav {
    --nav-inline: var(--spacing-md);
  }
}
</style>
