import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter, type Ref } from "vue"
import type { Router } from "vue-router"
import type { SessionMetadata } from "@earendil-works/pi-protocol"
import { errorMessage, platformRequest } from "@client/http.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import {
  PROJECT_PAGE,
  UPDATED_PAGE,
  bumpReveal,
  groupSessionsByCwd,
  listSessionsForSidebar,
  sidebarRows,
  type SidebarGrouping,
  type SidebarRow,
} from "@features/session-nav/sidebar.js"

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
    refreshSessionCards(): Promise<void>
  },
) {
  const addingWorkspace = ref(false)
  const workspaces = local.workspaces
  const groups = computed(() => groupSessionsByCwd(sessions.value, local.workspaces.value))
  const listedSessions = computed(() => listSessionsForSidebar(sessions.value))
  const grouping = ref<SidebarGrouping>(loadGrouping())
  const revealByGroup = shallowRef<Record<string, number>>({})

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
      [groupKey]: bumpReveal(revealByGroup.value[groupKey], page),
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
      })
    })
  }

  async function addWorkspace() {
    if (addingWorkspace.value) return
    addingWorkspace.value = true
    error.value = ""
    try {
      let result = await platformRequest<{ path: string | null; requiresManualInput?: boolean }>(
        "/api/v1/platform/select-directory",
        { method: "POST" },
      )
      if (result.requiresManualInput) {
        const path = window.prompt("输入本地目录路径")
        if (!path) return
        result = await platformRequest("/api/v1/platform/select-directory", {
          method: "POST",
          body: JSON.stringify({ path }),
        })
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
    try {
      await platformRequest("/api/v1/platform/rename-session", {
        method: "POST",
        body: JSON.stringify({ id, name }),
      })
      await admin.refreshSessions()
      await admin.refreshSessionCards()
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }
  async function deleteSession(id: string) {
    error.value = ""
    try {
      await platformRequest("/api/v1/platform/delete-session", {
        method: "POST",
        body: JSON.stringify({ id }),
      })
      if (admin.sessionId.value === id) await admin.router.replace("/")
      await admin.refreshSessions()
      await admin.refreshSessionCards()
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
    bumpGroup,
    rowsFor,
    addWorkspace,
    renameSession,
    deleteSession,
  }
}
