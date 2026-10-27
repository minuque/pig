<template>
  <SidebarView
    v-model:search-open="searchOpen"
    :groups="groups"
    :connected="connected"
    :sb-expanded="sbExpanded"
    :grouping="grouping"
    :sort="sort"
    :scope-filter="scopeFilter"
    :sections="sections"
    :card-foot-by-id="cardFootById"
    :listed-sessions="listedSessions"
    :pinned-ids="pinnedIds"
    :highlighted-session-id="highlightedSessionId"
    :expanded-sections="expandedSections"
    :expanded-by-group="expandedByGroup"
    @update:scope-filter="scopeFilter = $event"
    @update:grouping="setGrouping"
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
    @reorder-pinned="reorderPinned"
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
import { useNav, workspaceName } from "@features/session-nav/index.js"
import SidebarView from "@features/session-nav/components/SidebarView.vue"

const emit = defineEmits<{
  navigate: [canonicalPath: string]
  settings: []
}>()
const { sbState, setSbState } = useLeftPanelToggle()
const {
  groups,
  pinnedSessions,
  connected,
  lastCwd,
  highlightedSessionId,
  cancelPendingOpen,
  navError: workspaceError,
  addWorkspace,
  setDraftSession,
  listedSessions,
  openSession,
  primeSession,
  grouping,
  sort,
  setGrouping,
  setSort,
  sectionsFor,
  expandedSections,
  expandedByGroup,
  toggleSection,
  revealMore,
  collapseGroup,
  cardFootById,
  pinnedIds,
  togglePinned,
  renameSession,
  deleteSession,
  reorderPinned,
} = useNav()
const router = useRouter()
const scopeFilter = shallowRef<string | undefined>(undefined)
const searchOpen = shallowRef(false)
const sbExpanded = computed(() => sbState.value !== "offcanvas")
const include = computed(
  () => (session: { id: string; cwd?: string }) =>
    !scopeFilter.value || workspaceName(session.cwd ?? "") === scopeFilter.value,
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
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return

  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return
  event.preventDefault()
  searchOpen.value = true
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
