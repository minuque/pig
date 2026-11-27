import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter } from "vue"
import type {
  ModelMetadata,
  SessionMetadata,
  SessionSnapshot,
  TranscriptItem,
} from "@/types/common-type.js"
import type { ComposerPreset } from "@features/composer/type.js"
import type { ComposerPresetContext } from "@features/composer/index.js"
import type { NavContext } from "@features/session-nav/index.js"
import { moveSessionId, sidebarSections } from "@features/session-nav/lib/session-list.js"
import type { SidebarSection } from "@features/session-nav/type.js"
import type { SessionContext } from "@features/session/index.js"
import { emptyClientState, projectSessionSnapshot } from "@features/session/lib/session-state.js"
import { projectContextUsage } from "@features/session/lib/context-usage.js"
import {
  PAGE_CATALOG,
  PAGE_FOOTS,
  PAGE_GROUPS,
  PAGE_HISTORY_FAILED_ID,
  PAGE_PINNED,
  PAGE_PRESET,
  PAGE_RUNNING_SINCE,
  PAGE_SESSION_ID,
  PAGE_SESSIONS,
  PAGE_TASKS,
  PAGE_TIMINGS,
  PAGE_TRANSCRIPT,
  PAGE_USAGE,
  pagePlacement,
} from "@features/design-lab/lib/page-fixtures.js"

const noop = () => {}
const resolved = async () => undefined
export const PAGE_MODELS: ModelMetadata[] = PAGE_CATALOG.flatMap((vendor) =>
  vendor.models.map((model) => ({
    provider: vendor.id,
    id: model.id,
    name: model.name,
    api: vendor.id,
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200_000,
    maxTokens: 32_000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    supportedThinkingLevels: ["low", "medium", "high"],
    authenticated: true,
  })),
)

function snapshotOf(id: string): SessionSnapshot {
  const meta = PAGE_SESSIONS.find((item) => item.id === id) ?? PAGE_SESSIONS[0]!
  return {
    id,
    name: meta.sessionName ?? "",
    cwd: meta.cwd ?? "",
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt ?? meta.createdAt,
    phase: id === PAGE_SESSION_ID ? "turn" : "idle",
    model: PAGE_PRESET.model,
    thinkingLevel: "medium",
    attached: true,
    locked: false,
    revision: 1,
    transcript: [],
    queuedSteer: [],
    queuedSteerCount: 0,
    tasks: PAGE_TASKS,
    notices: [],
  }
}

const sentBySession = ref<Record<string, TranscriptItem[]>>({})

function transcriptOf(id: string): TranscriptItem[] {
  const base = id === PAGE_SESSION_ID ? PAGE_TRANSCRIPT : PAGE_TRANSCRIPT.slice(0, 8)
  return [...base, ...(sentBySession.value[id] ?? [])]
}

export function createPageSession(): SessionContext {
  const sessionId = ref<string | undefined>(PAGE_SESSION_ID)
  const snapshot = computed(() => (sessionId.value ? snapshotOf(sessionId.value) : undefined))
  const projection = computed(() =>
    snapshot.value ? projectSessionSnapshot(snapshot.value) : undefined,
  )
  const clientState = computed(() => emptyClientState())
  const draft = ref("把 compact 的头部高也对齐到 40px")
  const historyFailed = ref(true)
  const failing = computed(() => historyFailed.value && sessionId.value === PAGE_HISTORY_FAILED_ID)
  return {
    sessionId,
    projection,
    phase: computed(() => projection.value?.phase),
    running: computed(() => projection.value?.running ?? false),
    backgroundRunningIds: computed(() => new Set(["page-running"])),
    turnPending: computed(() => sessionId.value === PAGE_SESSION_ID),
    sessionPending: computed(() => false),
    connected: computed(() => true),
    connectionError: shallowRef<Error>(),
    reconnecting: shallowRef(false),
    reconnectFailed: shallowRef(false),
    reconnectNow: resolved,
    historyError: computed(() => undefined),
    historyFailed: failing,
    retryHistory: () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          historyFailed.value = false
          resolve()
        }, 1200),
      ),
    transcript: computed(() =>
      sessionId.value && !failing.value ? transcriptOf(sessionId.value) : [],
    ),
    welcome: computed(() => !sessionId.value),
    loadHistory: resolved,
    historyFresh: () => true,
    turnTimings: computed(() => PAGE_TIMINGS),
    sessionCwd: computed(() => snapshot.value?.cwd),
    contextUsage: computed(() => projectContextUsage(PAGE_USAGE)),
    tasks: computed(() => PAGE_TASKS),
    stopTask: resolved,
    snapshot,
    setModel: resolved,
    setThinking: resolved,
    setPresetPort: noop,
    prompt: computed({ get: () => draft.value, set: (value) => (draft.value = value) }),
    clientState,
    creating: ref<string>(),
    submitting: computed(() => false),
    aborting: computed(() => false),
    createSession: resolved,
    sendPrompt: async (text: string) => {
      const id = sessionId.value

      if (!id) return false
      const item: TranscriptItem = {
        id: `page-sent-${Date.now()}`,
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      }

      sentBySession.value = {
        ...sentBySession.value,
        [id]: [...(sentBySession.value[id] ?? []), item],
      }
      draft.value = ""
      return true
    },
    steer: resolved,
    setWelcomeHandoff: noop,
    transcriptFor: (id: string) => transcriptOf(id),
    externalTurn: computed(() => false),
    takeover: resolved,
    abortSession: resolved,
    reloadRevision: ref(0),
    initialize: resolved,
    remote: shallowRef(),
    teardown: noop,
  } as unknown as SessionContext
}

export function createPagePreset(): ComposerPresetContext {
  const preset = ref<ComposerPreset | undefined>(PAGE_PRESET)
  return {
    catalog: computed(() => PAGE_CATALOG),
    preset: computed({ get: () => preset.value, set: (next) => (preset.value = next) }),
    switchLocked: computed(() => false),
  } as unknown as ComposerPresetContext
}

export function createPageNav(session: SessionContext): NavContext {
  const allSessions = ref<SessionMetadata[]>(PAGE_SESSIONS)
  const pinnedOrder = ref<string[]>([...PAGE_PINNED])
  const pinnedIds = computed(() => new Set(pinnedOrder.value))
  const settledSet = ref(
    new Set(PAGE_SESSIONS.filter((item) => pagePlacement(item.id).settled).map((item) => item.id)),
  )
  const expandedSections = ref(new Set<string>())
  const moreBySection = ref<Record<string, number>>({})

  function sectionsFor(
    include?: MaybeRefOrGetter<((item: SessionMetadata) => boolean) | undefined>,
  ) {
    return computed<SidebarSection[]>(() => {
      const filter = include === undefined ? undefined : toValue(include)
      return sidebarSections({
        sessions: filter ? allSessions.value.filter(filter) : allSessions.value,
        pinnedOrder: pinnedOrder.value,
        placement: (id: string) => ({
          ...pagePlacement(id),
          settled: settledSet.value.has(id),
        }),
        moreBySection: moreBySection.value,
      })
    })
  }

  function unsettle(id: string) {
    if (!settledSet.value.has(id)) return
    const next = new Set(settledSet.value)

    next.delete(id)
    settledSet.value = next
  }

  function settle(id: string) {
    if (!settledSet.value.has(id)) {
      const next = new Set(settledSet.value)

      next.add(id)
      settledSet.value = next
    }

    if (pinnedIds.value.has(id)) {
      pinnedOrder.value = pinnedOrder.value.filter((item) => item !== id)
    }
  }

  function toggle(set: typeof expandedSections, key: string) {
    const next = new Set(set.value)

    if (next.has(key)) next.delete(key)
    else next.add(key)
    set.value = next
  }

  return {
    groups: computed(() => PAGE_GROUPS),
    allSessions,
    listedSessions: allSessions,
    projectByCwd: computed(() => new Map()),
    runningIds: computed(() => new Set(Object.keys(PAGE_RUNNING_SINCE))),
    cardFootById: computed(() => PAGE_FOOTS),
    revealMore: (key: string) =>
      (moreBySection.value = {
        ...moreBySection.value,
        [key]: (moreBySection.value[key] ?? 0) + 1,
      }),
    collapseGroup: (key: string) => (moreBySection.value = { ...moreBySection.value, [key]: 0 }),
    sectionsFor,
    moreBySection,
    runningSince: shallowRef(PAGE_RUNNING_SINCE),
    settledIds: computed(() => settledSet.value),
    settle,
    unsettle,
    expandedSections,
    toggleSection: (key: string) => toggle(expandedSections, key),
    expandSection: noop,
    pinnedIds,
    pinnedSessions: computed(() =>
      pinnedOrder.value.flatMap((id) => {
        const match = PAGE_SESSIONS.find((item) => item.id === id)
        return match ? [match] : []
      }),
    ),
    togglePinned: (id: string) => {
      if (pinnedIds.value.has(id)) {
        pinnedOrder.value = pinnedOrder.value.filter((item) => item !== id)
        return
      }

      unsettle(id)
      pinnedOrder.value = [...pinnedOrder.value, id]
    },
    reorderPinned: (id: string, toIndex: number) => {
      if (!pinnedIds.value.has(id)) return
      pinnedOrder.value = moveSessionId(pinnedOrder.value, id, toIndex)
    },
    pinAt: (id: string, toIndex: number) => {
      unsettle(id)
      pinnedOrder.value = moveSessionId(pinnedOrder.value, id, toIndex)
    },
    addingWorkspace: ref(false),
    connected: computed(() => true),
    navError: shallowRef(""),
    lastCwd: ref(PAGE_GROUPS[0]!.canonicalPath),
    activeWorkspaceId: computed(() => session.projection.value?.cwd),
    highlightedSessionId: computed(() => session.sessionId.value),
    openSession: (id: string) => {
      ;(session.sessionId as { value: string | undefined }).value = id
    },
    primeSession: noop,
    closeSession: noop,
    cancelPendingOpen: noop,
    setDraftSession: noop,
    addWorkspace: resolved,
    renameSession: resolved,
    deleteSession: resolved,
    deleteSessions: resolved,
    archiveSessions: resolved,
    unarchiveSessions: resolved,
  } as unknown as NavContext
}
