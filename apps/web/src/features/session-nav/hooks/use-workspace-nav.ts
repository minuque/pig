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
import { canonicalizeWorkspacePath, type useLocalWorkspaces } from "@client/local-cwd.js"
import {
  draftSessionId,
  groupSessionsByCwd,
  listSessionsForSidebar,
  sidebarSections,
} from "@features/session-nav/lib/session-list.js"
import type { SidebarGrouping, SidebarSection, SidebarSort } from "@features/session-nav/type.js"
import { readPref, writePref } from "@utils/storage.js"

type LocalWorkspaces = ReturnType<typeof useLocalWorkspaces>

const DELETE_RETRY_MS = 400
const GROUPING_KEY = "pig.sidebarGrouping"
const SORT_KEY = "pig.sidebarSort"

function loadGrouping(): SidebarGrouping {
  return readPref(GROUPING_KEY) === "cwd" ? "cwd" : "date"
}

function loadSort(): SidebarSort {
  return readPref(SORT_KEY) === "created" ? "created" : "updated"
}

function isBusy(error: unknown): boolean {
  return error instanceof PlatformRequestError && error.code === "BUSY"
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
    groupSessionsByCwd(visibleSessions.value, local.workspaces.value).map((group) => ({
      ...group,
      sessions: applyTitles(group.sessions),
    })),
  )
  const listedSessions = computed(() => applyTitles(listSessionsForSidebar(visibleSessions.value)))
  const expandedByGroup = shallowRef<Record<string, number>>({})

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
    draftSessionPath.value = path
  }

  function revealMore(groupKey: string) {
    expandedByGroup.value = {
      ...expandedByGroup.value,
      [groupKey]: (expandedByGroup.value[groupKey] ?? 0) + 1,
    }
  }

  function collapseGroup(groupKey: string) {
    const next = { ...expandedByGroup.value }
    delete next[groupKey]
    expandedByGroup.value = next
  }

  const grouping = shallowRef<SidebarGrouping>(loadGrouping())
  const sort = shallowRef<SidebarSort>(loadSort())

  function setGrouping(next: SidebarGrouping): void {
    grouping.value = next
    writePref(GROUPING_KEY, next)
  }

  function setSort(next: SidebarSort): void {
    sort.value = next
    writePref(SORT_KEY, next)
  }

  /** 已展开的段：目录/时间默认收起，置顶段默认展开，改动持久化。 */
  const EXPANDED_KEY = "pig.sidebarExpandedSections"
  const expandedSections = shallowRef<ReadonlySet<string>>(loadExpandedSections())

  function loadExpandedSections(): ReadonlySet<string> {
    const raw = readPref(EXPANDED_KEY)

    if (!raw) return new Set(["pinned"])

    try {
      const parsed = JSON.parse(raw)
      return new Set(Array.isArray(parsed) ? parsed : ["pinned"])
    } catch {
      return new Set(["pinned"])
    }
  }

  function toggleSection(key: string): void {
    const next = new Set(expandedSections.value)

    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedSections.value = next
    writePref(EXPANDED_KEY, JSON.stringify([...next]))
  }

  function sectionsFor(
    pinnedOrder: MaybeRefOrGetter<readonly string[]>,
    include?: MaybeRefOrGetter<((session: SessionMetadata) => boolean) | undefined>,
  ) {
    return computed((): SidebarSection[] => {
      const filter = include === undefined ? undefined : toValue(include)
      const sessions = filter ? listedSessions.value.filter(filter) : listedSessions.value
      return sidebarSections({
        sessions,
        pinnedOrder: toValue(pinnedOrder),
        grouping: grouping.value,
        sort: sort.value,
        localWorkspaces: workspaces.value,
        expandedByGroup: expandedByGroup.value,
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
    expandedByGroup,
    revealMore,
    collapseGroup,
    grouping,
    sort,
    setGrouping,
    setSort,
    expandedSections,
    toggleSection,
    sectionsFor,
    addWorkspace,
    renameSession,
    deleteSession,
    draftSessionId: draftSessionIdRef,
    setDraftSession,
  }
}
