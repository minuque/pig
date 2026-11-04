<template>
  <SidebarView
    v-model:search-open="searchOpen"
    :groups="groups"
    :connected="connected"
    :sort="sort"
    :scope-filter="scopeFilter"
    :sections="sections"
    :card-foot-by-id="cardFootById"
    :listed-sessions="listedSessions"
    :pinned-ids="pinnedIds"
    :highlighted-session-id="highlightedSessionId"
    :expanded-sections="expandedSections"
    :more-by-section="moreBySection"
    :status-counts="statusCounts"
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
    @snooze="snooze"
    @unsnooze="unsnooze"
    @reorder-pinned="reorderPinned"
    @pin-at="pinAt"
    @unpin="togglePinned"
    @toggle-section="toggleSection"
    @reveal-more="revealMore"
    @collapse-group="collapseGroup"
    @cycle-status="onCycleStatus"
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
import { isDraftSessionId, sessionInProjects } from "@features/session-nav/lib/session-list.js"
import {
  nextInCycle,
  statusBuckets,
  type FooterStatus,
} from "@features/session-nav/lib/status-cycle.js"
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
  sort,
  setSort,
  sectionsFor,
  expandedSections,
  moreBySection,
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
  snooze,
  unsnooze,
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
const statusBucketsById = computed(() =>
  statusBuckets(
    sections.value.flatMap((section) => section.sessions),
    cardFootById.value,
  ),
)
const statusCounts = computed<Record<FooterStatus, number>>(() => ({
  running: statusBucketsById.value.running.length,
  unread: statusBucketsById.value.unread.length,
  draft: statusBucketsById.value.draft.length,
}))

/** 点一次换下一个同状态会话；草稿没有路由，回到它所在的欢迎页。 */
function onCycleStatus(status: FooterStatus): void {
  const target = nextInCycle(statusBucketsById.value[status], highlightedSessionId.value)

  if (!target) return

  if (target.cwd) emit("navigate", target.cwd)

  if (isDraftSessionId(target.id)) {
    void router.push("/")
    return
  }

  openSession(target.id)
}

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
