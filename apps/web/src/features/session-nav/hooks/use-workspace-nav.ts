import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter, type Ref } from "vue"
import type { Router } from "vue-router"
import type { SessionMetadata } from "@/types/common-type.js"
import { errorMessage } from "@client/http.js"
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
  PROJECT_PAGE,
  UPDATED_PAGE,
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

type LocalWorkspaces = ReturnType<typeof useLocalWorkspaces>

export const SIDEBAR_GROUPING_KEY = "pig.sidebarGrouping"
export const SIDEBAR_VIEW_KEY = "pig.sidebarView"
export const SIDEBAR_SORT_KEY = "pig.sidebarSort"
export const SIDEBAR_ORDER_KEY = "pig.sidebarWorkspaceOrder"
export const SIDEBAR_COLLAPSED_KEY = "pig.sidebarCollapsed"

function loadView(): SidebarView {
  try {
    const stored = localStorage.getItem(SIDEBAR_VIEW_KEY)

    if (stored === "flat" || stored === "grouped") return stored
    return localStorage.getItem(SIDEBAR_GROUPING_KEY) === "updated" ? "flat" : "grouped"
  } catch {
    return "grouped"
  }
}

function saveView(value: SidebarView): void {
  try {
    localStorage.setItem(SIDEBAR_VIEW_KEY, value)
  } catch {
    /* 隐私模式等场景下存储不可用，偏好仅存活于本页 */
  }
}

function loadSort(): SidebarSort {
  try {
    return localStorage.getItem(SIDEBAR_SORT_KEY) === "recent" ? "recent" : "manual"
  } catch {
    return "manual"
  }
}

function saveSort(value: SidebarSort): void {
  try {
    localStorage.setItem(SIDEBAR_SORT_KEY, value)
  } catch {
    /* 同上 */
  }
}

function loadOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SIDEBAR_ORDER_KEY) ?? "[]")
    return Array.isArray(value)
      ? uniqueCanonicalPaths(value.filter((item): item is string => typeof item === "string"))
      : []
  } catch {
    return []
  }
}

function saveOrder(paths: readonly string[]): void {
  try {
    localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(paths))
  } catch {
    /* 同上 */
  }
}

function parseCollapsed(json: string | null): Record<string, boolean> {
  if (!json) return {}

  try {
    const value: unknown = JSON.parse(json)

    if (!Array.isArray(value)) return {}
    const next: Record<string, boolean> = {}

    for (const item of value) {
      if (typeof item !== "string" || item.length === 0) continue
      next[canonicalizeWorkspacePath(item)] = true
    }

    return next
  } catch {
    return {}
  }
}

function loadCollapsed(): Record<string, boolean> {
  try {
    return parseCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY))
  } catch {
    return {}
  }
}

function saveCollapsed(map: Readonly<Record<string, boolean>>): void {
  try {
    localStorage.setItem(
      SIDEBAR_COLLAPSED_KEY,
      JSON.stringify(Object.keys(map).filter((key) => map[key])),
    )
  } catch {
    /* 隐私模式等场景下存储不可用，偏好仅存活于本页 */
  }
}

export function useWorkspaceNav(
  sessions: Ref<readonly SessionMetadata[]>,
  local: LocalWorkspaces,
  error: Ref<string>,
  admin: {
    sessionId: Ref<string | undefined>
    router: Router
    refreshSessions(): Promise<void>
  },
) {
  const addingWorkspace = ref(false)
  const titleById = shallowRef<Record<string, string>>({})
  const workspaces = local.workspaces
  const groups = computed(() =>
    orderSessionGroups(
      groupSessionsByCwd(sessions.value, local.workspaces.value).map((group) => ({
        ...group,
        sessions: applyTitles(group.sessions),
      })),
      sort.value,
      manualOrder.value,
    ),
  )
  const listedSessions = computed(() => applyTitles(listSessionsForSidebar(sessions.value)))
  const view = ref<SidebarView>(loadView())
  const sort = ref<SidebarSort>(loadSort())
  const manualOrder = shallowRef<string[]>(loadOrder())
  const grouping = computed<SidebarGrouping>(() => (view.value === "flat" ? "updated" : "project"))
  const revealByGroup = shallowRef<Record<string, number>>({})
  const collapsedByGroup = shallowRef<Record<string, boolean>>(loadCollapsed())

  function applyTitles(list: readonly SessionMetadata[]): SessionMetadata[] {
    const titles = titleById.value

    if (Object.keys(titles).length === 0) return [...list]
    return list.map((session) => {
      const sessionName = titles[session.id]
      return sessionName === undefined ? session : { ...session, sessionName }
    })
  }

  function setView(next: SidebarView) {
    if (next !== view.value) {
      view.value = next
      revealByGroup.value = {}
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

  function bumpGroup(groupKey: string) {
    const page = grouping.value === "updated" ? UPDATED_PAGE : PROJECT_PAGE
    revealByGroup.value = {
      ...revealByGroup.value,
      [groupKey]: (revealByGroup.value[groupKey] ?? page) + page,
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
        revealByGroup: revealByGroup.value,
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
        const path = window.prompt("输入本地目录路径")

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

  async function deleteSession(id: string) {
    error.value = ""

    try {
      await requestDeleteSession(id)

      if (admin.sessionId.value === id) await admin.router.replace("/")
      await admin.refreshSessions()
    } catch (cause) {
      error.value = errorMessage(cause)
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
    revealByGroup,
    collapsedByGroup,
    bumpGroup,
    toggleGroup,
    setGroupsCollapsed,
    rowsFor,
    addWorkspace,
    renameSession,
    deleteSession,
  }
}
