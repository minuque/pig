import {
  computed,
  nextTick,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { errorMessage, PlatformRequestError } from "@client/http.js"
import {
  archivedSessionIds,
  archiveSessions as requestArchiveSessions,
  removeArchivedSessionLocal,
  unarchiveSessions as requestUnarchiveSessions,
} from "@client/session-archives.js"
import { notify } from "@components/layout/notify.js"
import { t } from "@i18n/index.js"
import {
  deleteSession as requestDeleteSession,
  renameSession as requestRenameSession,
  selectDirectory,
} from "@client/platform.js"
import { canonicalizeWorkspacePath, type useLocalWorkspaces } from "@client/local-cwd.js"
import {
  draftSessionId,
  groupSessionsByProject,
  listSessionsForSidebar,
  sidebarSections,
} from "@features/session-nav/lib/session-list.js"
import type { SidebarPlacement, SidebarSection } from "@features/session-nav/type.js"
import { readPref, writePref } from "@utils/storage.js"

type LocalWorkspaces = ReturnType<typeof useLocalWorkspaces>

const DELETE_RETRY_MS = 400

function isBusy(error: unknown): boolean {
  return error instanceof PlatformRequestError && error.code === "BUSY"
}

export function useWorkspaceNav(
  sessions: Ref<readonly SessionMetadata[]>,
  local: LocalWorkspaces,
  error: Ref<string>,
  admin: {
    sessionId: Ref<string | undefined>
    shownIds: Ref<readonly (string | undefined)[]>
    isRunning(id: string): boolean
    leave(id: string): void
    refreshSessions(): Promise<void>
  },
) {
  const addingWorkspace = ref(false)
  const titleById = shallowRef<Record<string, string>>({})
  const workspaces = local.workspaces
  const deletingIds = shallowRef<ReadonlySet<string>>(new Set())
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
  const allSessions = computed(() =>
    sessions.value.filter((session) => !deletingIds.value.has(session.id)),
  )
  const visibleSessions = computed(() => {
    const all = allSessions.value
    const archived = archivedSessionIds.value
    const list = archived.size === 0 ? all : all.filter((session) => !archived.has(session.id))
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
    groupSessionsByProject(visibleSessions.value, local.workspaces.value).map((group) => ({
      ...group,
      sessions: applyTitles(group.sessions),
    })),
  )
  const listedSessions = computed(() => applyTitles(listSessionsForSidebar(visibleSessions.value)))
  const moreBySection = shallowRef<Record<string, number>>({})

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
    moreBySection.value = {
      ...moreBySection.value,
      [groupKey]: (moreBySection.value[groupKey] ?? 0) + 1,
    }
  }

  function collapseGroup(groupKey: string) {
    const next = { ...moreBySection.value }
    delete next[groupKey]
    moreBySection.value = next
  }

  const EXPANDED_KEY = "pig.sidebarShelfExpanded"
  const SECTION_KEYS = new Set(["pinned", "active", "working", "settled"])
  const expandedSections = shallowRef<ReadonlySet<string>>(loadExpandedSections())

  function loadExpandedSections(): ReadonlySet<string> {
    const raw = readPref(EXPANDED_KEY)

    if (!raw) return new Set()

    try {
      const parsed: unknown = JSON.parse(raw)
      return new Set(
        Array.isArray(parsed)
          ? parsed.filter((key): key is string => typeof key === "string" && SECTION_KEYS.has(key))
          : [],
      )
    } catch {
      return new Set()
    }
  }

  function toggleSection(key: string): void {
    const next = new Set(expandedSections.value)

    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedSections.value = next
    writePref(EXPANDED_KEY, JSON.stringify([...next]))
  }

  function expandSection(key: string): void {
    if (expandedSections.value.has(key)) return
    toggleSection(key)
  }

  function sectionsFor(
    pinnedOrder: MaybeRefOrGetter<readonly string[]>,
    placement: (id: string) => SidebarPlacement,
    include?: MaybeRefOrGetter<((session: SessionMetadata) => boolean) | undefined>,
  ) {
    return computed((): SidebarSection[] => {
      const filter = include === undefined ? undefined : toValue(include)
      const sessions = filter ? listedSessions.value.filter(filter) : listedSessions.value
      return sidebarSections({
        sessions,
        pinnedOrder: toValue(pinnedOrder),
        placement,
        moreBySection: moreBySection.value,
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

  async function addRemoteWorkspace(environment: string, path: string): Promise<boolean> {
    const result = await selectDirectory(path, environment).catch(() => undefined)

    if (!result?.path) return false
    local.add(result.path)
    local.selectCwd(result.path)
    return true
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

  async function runDeleteSingle(id: string): Promise<boolean> {
    if (admin.isRunning(id)) {
      error.value = t("session.stopRunningBeforeDelete")
      return false
    }

    setDeleting(id, true)

    try {
      if (admin.shownIds.value.includes(id)) {
        admin.leave(id)
        await nextTick()
      }

      await requestDeleteSession(id).catch(async (cause: unknown) => {
        if (!isBusy(cause)) throw cause
        await new Promise((resolve) => setTimeout(resolve, DELETE_RETRY_MS))
        await requestDeleteSession(id)
      })
      removeArchivedSessionLocal(id)
      return true
    } catch (cause) {
      error.value = isBusy(cause) ? t("session.stopRunningBeforeDelete") : errorMessage(cause)
      return false
    } finally {
      setDeleting(id, false)
    }
  }

  async function deleteSession(id: string) {
    error.value = ""

    if (await runDeleteSingle(id)) await admin.refreshSessions()
  }

  async function deleteSessions(ids: readonly string[]) {
    error.value = ""
    const unique = [...new Set(ids)]

    if (unique.length === 0) return
    let deletedCount = 0

    for (const id of unique) {
      if (admin.isRunning(id)) continue

      if (await runDeleteSingle(id)) deletedCount += 1
    }

    if (deletedCount > 0) await admin.refreshSessions()

    if (deletedCount > 1)
      notify(t("settings.archive.deleteBatchDone", { count: deletedCount }), "info", {
        transient: true,
      })

    if (error.value) notify(error.value, "error", { transient: true })
  }

  function formatArchiveNotice(
    keySingle: string,
    keyBatch: string,
    ids: readonly string[],
  ): string {
    if (ids.length > 1) return t(keyBatch, { count: ids.length })
    const found = sessions.value.find((session) => session.id === ids[0])
    const title = found?.sessionName?.trim() || t("session.untitled")
    return t(keySingle, { title })
  }

  async function archiveSessions(ids: readonly string[], options?: { silent?: boolean }) {
    const unique = [...new Set(ids)]

    if (unique.length === 0) return
    const eligible = unique.filter((id) => !admin.isRunning(id))

    if (eligible.length === 0) {
      notify(t("session.archiveSkippedRunning"), "warning", { transient: true })
      return
    }

    try {
      await requestArchiveSessions(eligible)

      for (const id of eligible) {
        if (admin.shownIds.value.includes(id)) admin.leave(id)
      }

      if (options?.silent) return

      const message = formatArchiveNotice(
        "session.archiveSingleDone",
        "session.archiveBatchDone",
        eligible,
      )

      notify(message, "info", {
        transient: true,
        action: {
          label: t("session.undo"),
          icon: "undo",
          run: () => {
            void unarchiveSessions(eligible, { silent: true })
          },
        },
      })
    } catch {
      notify(t("session.archiveFailed"), "error", { transient: true })
    }
  }

  async function unarchiveSessions(ids: readonly string[], options?: { silent?: boolean }) {
    const unique = [...new Set(ids)]

    if (unique.length === 0) return

    try {
      await requestUnarchiveSessions(unique)

      if (options?.silent) return

      const message = formatArchiveNotice(
        "session.unarchiveSingleDone",
        "session.unarchiveBatchDone",
        unique,
      )

      notify(message, "info", {
        transient: true,
        action: {
          label: t("session.undo"),
          icon: "undo",
          run: () => {
            void archiveSessions(unique, { silent: true })
          },
        },
      })
    } catch {
      notify(t("session.unarchiveFailed"), "error", { transient: true })
    }
  }

  return {
    addingWorkspace,
    workspaces,
    groups,
    allSessions,
    listedSessions,
    moreBySection,
    revealMore,
    collapseGroup,
    expandedSections,
    toggleSection,
    expandSection,
    sectionsFor,
    addWorkspace,
    addRemoteWorkspace,
    renameSession,
    deleteSession,
    deleteSessions,
    archiveSessions,
    unarchiveSessions,
    draftSessionId: draftSessionIdRef,
    setDraftSession,
  }
}
