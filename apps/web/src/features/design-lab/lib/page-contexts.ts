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
import { sidebarSections } from "@features/session-nav/lib/session-list.js"
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

function transcriptOf(id: string): TranscriptItem[] {
  return id === PAGE_SESSION_ID ? PAGE_TRANSCRIPT : PAGE_TRANSCRIPT.slice(0, 8)
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
    sendPrompt: resolved,
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
  const pinnedIds = ref(new Set(PAGE_PINNED))
  const expandedSections = ref(new Set<string>())
  const settledIds = ref(
    new Set(PAGE_SESSIONS.filter((item) => pagePlacement(item.id).settled).map((item) => item.id)),
  )
  const moreBySection = ref<Record<string, number>>({})

  function sectionsFor(
    include?: MaybeRefOrGetter<((item: SessionMetadata) => boolean) | undefined>,
  ) {
    return computed<SidebarSection[]>(() => {
      const filter = include === undefined ? undefined : toValue(include)
      return sidebarSections({
        sessions: filter ? allSessions.value.filter(filter) : allSessions.value,
        pinnedOrder: [...pinnedIds.value],
        placement: (id) => ({
          running: pagePlacement(id).running,
          settled: settledIds.value.has(id),
        }),
        moreBySection: moreBySection.value,
      })
    })
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
    settledIds,
    settle: (id: string) => (settledIds.value = new Set(settledIds.value).add(id)),
    unsettle: (id: string) => {
      const next = new Set(settledIds.value)

      next.delete(id)
      settledIds.value = next
    },
    expandedSections,
    toggleSection: (key: string) => toggle(expandedSections, key),
    expandSection: noop,
    pinnedIds,
    pinnedSessions: computed(() => PAGE_SESSIONS.filter((item) => pinnedIds.value.has(item.id))),
    togglePinned: (id: string) => {
      const next = new Set(pinnedIds.value)

      if (next.has(id)) next.delete(id)
      else next.add(id)
      pinnedIds.value = next
    },
    reorderPinned: noop,
    pinAt: noop,
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
