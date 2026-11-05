<template>
  <SidebarView
    v-model:search-open="searchOpen"
    :groups="groups"
    :sort="sort"
    :scope-filter="scopeFilter"
    :sections="sections"
    :card-foot-by-id="cardFootById"
    :listed-sessions="listedSessions"
    :pinned-ids="pinnedIds"
    :highlighted-session-id="highlightedSessionId"
    :expanded-sections="expandedSections"
    :more-by-section="moreBySection"
    :running-since="runningSince"
    @update:scope-filter="scopeFilter = $event"
    @update:sort="setSort"
    @toggle-sidebar="onToggleSidebar"
    @create="onCreateSession"
    @add-project="onAddProject"
    @settings="emit('settings')"
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
import SidebarView from "@features/session-nav/components/SidebarView.vue"

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
