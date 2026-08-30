import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter, type Ref } from "vue"
import type { Router } from "vue-router"
import type { SessionMetadata } from "@earendil-works/pi-protocol"
import { errorMessage } from "@client/http.js"
import {
  deleteSession as requestDeleteSession,
  renameSession as requestRenameSession,
  selectDirectory,
} from "@client/platform.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import {
  PROJECT_PAGE,
  UPDATED_PAGE,
  groupSessionsByCwd,
  listSessionsForSidebar,
  sidebarRows,
  type SidebarGrouping,
  type SidebarRow,
} from "@features/session-nav/lib/session-list.js"

type LocalWorkspaces = ReturnType<typeof useLocalWorkspaces>

export const SIDEBAR_GROUPING_KEY = "pig.sidebarGrouping"

function parseGrouping(raw: string | null): SidebarGrouping {
  return raw === "project" ? "project" : "updated"
}

function loadGrouping(): SidebarGrouping {
  try {
    return parseGrouping(localStorage.getItem(SIDEBAR_GROUPING_KEY))
  } catch {
    return "updated"
  }
}

function saveGrouping(value: SidebarGrouping): void {
  try {
    localStorage.setItem(SIDEBAR_GROUPING_KEY, value)
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
  refreshSessionCards: () => Promise<void> = async () => undefined,
) {
  const addingWorkspace = ref(false)
  const titleById = shallowRef<Record<string, string>>({})
  const workspaces = local.workspaces
  const groups = computed(() =>
    groupSessionsByCwd(sessions.value, local.workspaces.value).map((group) => ({
      ...group,
      sessions: applyTitles(group.sessions),
    })),
  )
  const listedSessions = computed(() => applyTitles(listSessionsForSidebar(sessions.value)))
  const grouping = ref<SidebarGrouping>(loadGrouping())
  const revealByGroup = shallowRef<Record<string, number>>({})
  const collapsedByGroup = shallowRef<Record<string, boolean>>({})

  function applyTitles(list: readonly SessionMetadata[]): SessionMetadata[] {
    const titles = titleById.value
    if (Object.keys(titles).length === 0) return [...list]
    return list.map((session) => {
      const sessionName = titles[session.id]
      return sessionName === undefined ? session : { ...session, sessionName }
    })
  }

  function setGrouping(next: SidebarGrouping) {
    if (next !== grouping.value) {
      grouping.value = next
      revealByGroup.value = {}
    }
    saveGrouping(next)
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
  }

  function rowsFor(
    searching: MaybeRefOrGetter<boolean>,
    filteredSessions?: MaybeRefOrGetter<readonly SessionMetadata[]>,
  ) {
    return computed((): SidebarRow[] => {
      const searchingNow = toValue(searching)
      const sessionList =
        filteredSessions === undefined ? listedSessions.value : toValue(filteredSessions)
      const ids = new Set(sessionList.map((session) => session.id))
      const groupList =
        filteredSessions === undefined
          ? groups.value
          : groups.value.map((group) => ({
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
    void refreshSessionCards()
  }
  async function deleteSession(id: string) {
    error.value = ""
    try {
      await requestDeleteSession(id)
      if (admin.sessionId.value === id) await admin.router.replace("/")
      await admin.refreshSessions()
      void refreshSessionCards()
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }
  return {
    addingWorkspace,
    workspaces,
    groups,
    listedSessions,
    grouping,
    setGrouping,
    revealByGroup,
    collapsedByGroup,
    bumpGroup,
    toggleGroup,
    rowsFor,
    addWorkspace,
    renameSession,
    deleteSession,
  }
}
