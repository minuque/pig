import { computed, ref, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import type { Router } from "vue-router"
import type { SessionMetadata } from "@/types/common-type.js"
import { errorMessage, PlatformRequestError } from "@client/http.js"
import { t } from "@i18n/index.js"
import {
  deleteSession as requestDeleteSession,
  renameSession as requestRenameSession,
  selectDirectory,
} from "@client/platform.js"
import {
  canonicalizeWorkspacePath,
  uniqueCanonicalPaths,
  type useLocalWorkspaces,
} from "@client/local-cwd.js"
import {
  draftSessionId,
  groupSessionsByCwd,
  listSessionsForSidebar,
  orderSessionGroups,
  sidebarRows,
} from "@features/session-nav/lib/session-list.js"
import type {
  SidebarGrouping,
  SidebarRow,
  SidebarSort,
  SidebarView,
} from "@features/session-nav/type.js"
import { readPref, readStringArray, writeJson, writePref } from "@utils/storage.js"

type LocalWorkspaces = ReturnType<typeof useLocalWorkspaces>

export const SIDEBAR_GROUPING_KEY = "pig.sidebarGrouping"
export const SIDEBAR_VIEW_KEY = "pig.sidebarView"
export const SIDEBAR_SORT_KEY = "pig.sidebarSort"
export const SIDEBAR_ORDER_KEY = "pig.sidebarWorkspaceOrder"
export const SIDEBAR_COLLAPSED_KEY = "pig.sidebarCollapsed"
const DELETE_RETRY_MS = 400

function isBusy(error: unknown): boolean {
  return error instanceof PlatformRequestError && error.code === "BUSY"
}

function loadView(): SidebarView {
  const stored = readPref(SIDEBAR_VIEW_KEY)

  if (stored === "flat" || stored === "grouped") return stored
  return readPref(SIDEBAR_GROUPING_KEY) === "updated" ? "flat" : "grouped"
}

function saveView(value: SidebarView): void {
  writePref(SIDEBAR_VIEW_KEY, value)
}

function loadSort(): SidebarSort {
  return readPref(SIDEBAR_SORT_KEY) === "recent" ? "recent" : "manual"
}

function saveSort(value: SidebarSort): void {
  writePref(SIDEBAR_SORT_KEY, value)
}

function loadOrder(): string[] {
  return uniqueCanonicalPaths(readStringArray(SIDEBAR_ORDER_KEY))
}

function saveOrder(paths: readonly string[]): void {
  writeJson(SIDEBAR_ORDER_KEY, paths)
}

function loadCollapsed(): Record<string, boolean> {
  const next: Record<string, boolean> = {}

  for (const item of readStringArray(SIDEBAR_COLLAPSED_KEY)) {
    if (item.length === 0) continue
    next[canonicalizeWorkspacePath(item)] = true
  }

  return next
}

function saveCollapsed(map: Readonly<Record<string, boolean>>): void {
  writeJson(
    SIDEBAR_COLLAPSED_KEY,
    Object.keys(map).filter((key) => map[key]),
  )
}

export function useWorkspaceNav(
  sessions: Ref<readonly SessionMetadata[]>,
  local: LocalWorkspaces,
  error: Ref<string>,
  admin: {
    sessionId: Ref<string | undefined>
    running: Ref<boolean>
    router: Router
    refreshSessions(): Promise<void>
  },
) {
  const addingWorkspace = ref(false)
  const titleById = shallowRef<Record<string, string>>({})
  const workspaces = local.workspaces
  /** 已确认删除、等落地的会话：先隐藏，失败再恢复。 */
  const deletingIds = shallowRef<ReadonlySet<string>>(new Set())
  /** 未发送首条 Prompt 的临时新会话占位目录。 */
  const draftSessionPath = shallowRef<string>()
  const draftSessionIdRef = computed(() =>
    draftSessionPath.value ? draftSessionId(draftSessionPath.value) : undefined,
  )
  const draftSession = computed<SessionMetadata | undefined>(() => {
    const path = draftSessionPath.value
    const id = draftSessionIdRef.value

    if (!path || !id) return undefined
    return {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cwd: path,
    }
  })
  const visibleSessions = computed(() => {
    const list = sessions.value.filter((session) => !deletingIds.value.has(session.id))
    const draft = draftSession.value
    return draft && !list.some((session) => session.id === draft.id) ? [draft, ...list] : list
  })

  watch(
    () => admin.sessionId.value,
    (id) => {
      if (id) draftSessionPath.value = undefined
    },
  )

  const groups = computed(() =>
    orderSessionGroups(
      groupSessionsByCwd(visibleSessions.value, local.workspaces.value).map((group) => ({
        ...group,
        sessions: applyTitles(group.sessions),
      })),
      sort.value,
      manualOrder.value,
    ),
  )
  const listedSessions = computed(() => applyTitles(listSessionsForSidebar(visibleSessions.value)))
  const view = ref<SidebarView>(loadView())
  const sort = ref<SidebarSort>(loadSort())
  const manualOrder = shallowRef<string[]>(loadOrder())
  const grouping = computed<SidebarGrouping>(() => (view.value === "flat" ? "updated" : "project"))
  const expandedByGroup = shallowRef<Record<string, boolean>>({})
  const collapsedByGroup = shallowRef<Record<string, boolean>>(loadCollapsed())

  function applyTitles(list: readonly SessionMetadata[]): SessionMetadata[] {
    const titles = titleById.value

    if (Object.keys(titles).length === 0) return [...list]
    return list.map((session) => {
      const sessionName = titles[session.id]
      return sessionName === undefined ? session : { ...session, sessionName }
    })
  }

  function setDeleting(id: string, on: boolean): void {
    const next = new Set(deletingIds.value)

    if (on) next.add(id)
    else next.delete(id)
    deletingIds.value = next
  }

  function setDraftSession(canonicalPath: string): void {
    const path = canonicalizeWorkspacePath(canonicalPath)

    if (collapsedByGroup.value[path]) {
      collapsedByGroup.value = { ...collapsedByGroup.value, [path]: false }
      saveCollapsed(collapsedByGroup.value)
    }

    draftSessionPath.value = path
  }

  function setView(next: SidebarView) {
    if (next !== view.value) {
      view.value = next
      expandedByGroup.value = {}
    }

    saveView(next)
  }

  function setSort(next: SidebarSort) {
    sort.value = next
    saveSort(next)
  }

  function reorderGroups(paths: readonly string[]) {
    manualOrder.value = uniqueCanonicalPaths(paths)
    sort.value = "manual"
    saveOrder(manualOrder.value)
    saveSort("manual")
  }

  function toggleGroupReveal(groupKey: string) {
    expandedByGroup.value = {
      ...expandedByGroup.value,
      [groupKey]: !expandedByGroup.value[groupKey],
    }
  }

  function toggleGroup(groupKey: string) {
    collapsedByGroup.value = {
      ...collapsedByGroup.value,
      [groupKey]: !collapsedByGroup.value[groupKey],
    }
    saveCollapsed(collapsedByGroup.value)
  }

  function setGroupsCollapsed(collapsed: boolean) {
    const next = { ...collapsedByGroup.value }

    for (const group of groups.value) next[group.canonicalPath] = collapsed
    collapsedByGroup.value = next
    saveCollapsed(next)
  }

  function rowsFor(
    searching: MaybeRefOrGetter<boolean>,
    excludedIds?: MaybeRefOrGetter<ReadonlySet<string>>,
  ) {
    return computed((): SidebarRow[] => {
      const searchingNow = toValue(searching)
      const excluded = excludedIds === undefined ? undefined : toValue(excludedIds)
      const sessionList = excluded
        ? listedSessions.value.filter((session) => !excluded.has(session.id))
        : listedSessions.value
      const ids = new Set(sessionList.map((session) => session.id))
      const groupList = groups.value.map((group) => ({
        canonicalPath: group.canonicalPath,
        sessions: group.sessions.filter((session) => ids.has(session.id)),
      }))
      return sidebarRows({
        grouping: grouping.value,
        sessions: sessionList,
        groups: groupList,
        expandedByGroup: expandedByGroup.value,
        searching: searchingNow,
        collapsedByGroup: collapsedByGroup.value,
      })
    })
  }

  async function addWorkspace() {
    if (addingWorkspace.value) return
    addingWorkspace.value = true
    error.value = ""

    try {
      let result = await selectDirectory()

      if (result.requiresManualInput) {
        const path = window.prompt(t("errors.localDirPrompt"))

        if (!path) return
        result = await selectDirectory(path)
      }

      if (result.path) {
        local.add(result.path)
        local.selectCwd(result.path)
      }
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      addingWorkspace.value = false
    }
  }

  async function renameSession(id: string, name: string) {
    error.value = ""
    titleById.value = { ...titleById.value, [id]: name }

    try {
      await requestRenameSession(id, name)
    } catch (cause) {
      const next = { ...titleById.value }
      delete next[id]
      titleById.value = next
      error.value = errorMessage(cause)
      return
    }

    void admin.refreshSessions().catch((cause) => {
      error.value = errorMessage(cause)
    })
  }

  /** 先离开再删：服务端仍有活 runtime 时回 BUSY，等 detach 落地后重试一次。 */
  async function deleteSession(id: string) {
    error.value = ""

    if (admin.sessionId.value === id && admin.running.value) {
      error.value = t("session.stopRunningBeforeDelete")
      return
    }

    setDeleting(id, true)

    try {
      if (admin.sessionId.value === id) await admin.router.replace("/")
      await requestDeleteSession(id).catch(async (cause: unknown) => {
        if (!isBusy(cause)) throw cause
        await new Promise((resolve) => setTimeout(resolve, DELETE_RETRY_MS))
        await requestDeleteSession(id)
      })
      await admin.refreshSessions()
    } catch (cause) {
      error.value = isBusy(cause) ? t("session.stopRunningBeforeDelete") : errorMessage(cause)
    } finally {
      // 成功时列表已刷新、该会话已不在，移除不会闪回；失败则用进场动画回到原位
      setDeleting(id, false)
    }
  }

  return {
    addingWorkspace,
    workspaces,
    groups,
    listedSessions,
    view,
    sort,
    grouping,
    setView,
    setSort,
    reorderGroups,
    collapsedByGroup,
    toggleGroupReveal,
    toggleGroup,
    setGroupsCollapsed,
    rowsFor,
    addWorkspace,
    renameSession,
    deleteSession,
    draftSessionId: draftSessionIdRef,
    setDraftSession,
  }
}
