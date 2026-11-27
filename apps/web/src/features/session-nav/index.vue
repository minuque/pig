<template>
  <div class="session-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <NavHeader
      v-model:search-open="searchOpen"
      v-model:scope-filter="scopeFilter"
      :groups="groups"
      :sessions="listedSessions"
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
      @settle="onSettleOne"
      @unsettle="unsettle"
      @settle-many="onSettleMany"
      @unsettle-many="onUnsettleMany"
      @archive="onArchiveSession"
      @reorder-pinned="reorderPinned"
      @pin-at="pinAt"
      @unpin="togglePinned"
      @toggle-section="toggleSection"
      @reveal-more="revealMore"
      @collapse-group="collapseGroup"
      @filter-project="scopeFilter = new Set([canonicalizeWorkspacePath($event)])"
    />

    <NavFooter @settings="emit('settings')" />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useEventListener } from "@vueuse/core"
import { useRouter } from "vue-router"
import { useI18n } from "@i18n/index.js"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { toastAction, toastStatus } from "@pig/ui/toast"
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
  allSessions,
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
  archiveSessions,
  reorderPinned,
  pinAt,
} = useNav()
const { t } = useI18n()
const router = useRouter()
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

  if (!text) return
  toastStatus(text, { tone: "error" })
  workspaceError.value = ""
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

function onArchiveSession(id: string): void {
  void archiveSessions([id])
}

function onSettleOne(id: string): void {
  settle(id)
  const found = allSessions.value.find((item) => item.id === id)
  const title = found?.sessionName?.trim() || t("session.untitled")

  toastAction(t("session.settledSingle", { title }), {
    label: t("session.undo"),
    icon: "undo",
    revertedLabel: t("session.restoredToInbox"),
    run: () => unsettle(id),
  })
}

function onSettleMany(ids: readonly string[]): void {
  if (ids.length === 1) return onSettleOne(ids[0]!)

  for (const id of ids) settle(id)

  toastAction(t("session.settledBatch", { count: ids.length }), {
    label: t("session.undo"),
    icon: "undo",
    revertedLabel: t("session.restoredToInbox"),
    run: () => onUnsettleMany(ids),
  })
}

function onUnsettleMany(ids: readonly string[]): void {
  for (const id of ids) unsettle(id)
}
</script>

<style scoped>
.session-nav {
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

html[data-pig-desktop-platform="darwin"] .session-nav > .titlebar-drag {
  display: block;
}

html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: var(--titlebar-inset);
}
</style>
