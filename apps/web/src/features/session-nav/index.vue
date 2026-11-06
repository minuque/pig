<template>
  <div class="session-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <NavHeader
      v-model:search-open="searchOpen"
      v-model:scope-filter="scopeFilter"
      :groups="groups"
      :sort="sort"
      :sessions="listedSessions"
      @update:sort="setSort"
      @toggle-sidebar="onToggleSidebar"
      @add-project="onAddProject"
      @create="onCreateSession"
      @open="openSession"
    />

    <SessionList
      :sections="sections"
      :card-foot-by-id="cardFootById"
      :pinned-ids="pinnedIds"
      :highlighted-session-id="highlightedSessionId"
      :expanded-sections="expandedSections"
      :more-by-section="moreBySection"
      :running-since="runningSince"
      @navigate="onSessionNavigate"
      @open="openSession"
      @prime="primeSession"
      @toggle-pinned="togglePinned"
      @rename="renameSession"
      @delete="deleteSession"
      @settle="settle"
      @unsettle="unsettle"
      @reorder-pinned="reorderPinned"
      @pin-at="pinAt"
      @unpin="togglePinned"
      @toggle-section="toggleSection"
      @reveal-more="revealMore"
      @collapse-group="collapseGroup"
    />

    <NavFooter @settings="emit('settings')" />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useEventListener } from "@vueuse/core"
import { useRouter } from "vue-router"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { notifyAction } from "@components/layout/notify.js"
import { useNav } from "@features/session-nav/index.js"
import { sessionInProjects } from "@features/session-nav/lib/session-list.js"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import NavHeader from "@features/session-nav/components/NavHeader.vue"
import SessionList from "@features/session-nav/components/SessionList.vue"

const emit = defineEmits<{
  navigate: [canonicalPath: string]
  settings: []
}>()
const { sbState, setSbState } = useLeftPanelToggle()
const {
  groups,
  pinnedSessions,
  lastCwd,
  highlightedSessionId,
  cancelPendingOpen,
  navError: workspaceError,
  addWorkspace,
  setDraftSession,
  listedSessions,
  openSession,
  primeSession,
  sort,
  setSort,
  sectionsFor,
  expandedSections,
  moreBySection,
  runningSince,
  toggleSection,
  revealMore,
  collapseGroup,
  cardFootById,
  pinnedIds,
  togglePinned,
  renameSession,
  deleteSession,
  settle,
  unsettle,
  reorderPinned,
  pinAt,
} = useNav()
const router = useRouter()
/** 选中的项目路径；空集合显示全部。 */
const scopeFilter = shallowRef<ReadonlySet<string>>(new Set())
const searchOpen = shallowRef(false)
const sbExpanded = computed(() => sbState.value !== "offcanvas")
const include = computed(
  () => (session: { id: string; cwd?: string }) =>
    sessionInProjects(session.cwd, scopeFilter.value),
)
const sections = sectionsFor(include)

function highlightedCwd(): string | undefined {
  const id = highlightedSessionId.value

  if (!id) return undefined

  const pinned = pinnedSessions.value.find((session) => session.id === id)

  if (pinned?.cwd) return canonicalizeWorkspacePath(pinned.cwd)

  for (const group of groups.value) {
    if (group.sessions.some((session) => session.id === id)) return group.canonicalPath
  }

  return undefined
}

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey)) return

  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return

  // 输入框是 contenteditable，不是 input/textarea，打字时也要让开
  if (event.target instanceof HTMLElement && event.target.isContentEditable) return

  const key = event.key.toLowerCase()

  if (key === "k") {
    event.preventDefault()
    searchOpen.value = true
    return
  }

  if (key === "n") {
    event.preventDefault()
    onCreateSession()
  }
})

watch(workspaceError, (message) => {
  const text = message.trim()

  if (text) notifyAction(text)
})

function onToggleSidebar(): void {
  setSbState(sbExpanded.value ? "offcanvas" : "expanded")
}

function onSessionNavigate(cwd: string | undefined): void {
  if (cwd) emit("navigate", cwd)
}

function onCreateInDir(canonicalPath: string): void {
  cancelPendingOpen()
  setDraftSession(canonicalPath)
  emit("navigate", canonicalPath)
  void router.push("/")
}

function onAddProject(): void {
  void addWorkspace()
}

function onCreateSession(cwd?: string): void {
  const path = cwd ?? highlightedCwd() ?? lastCwd.value ?? groups.value[0]?.canonicalPath

  if (path) return onCreateInDir(path)
  void addWorkspace()
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
