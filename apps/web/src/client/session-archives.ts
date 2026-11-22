import { computed, shallowRef, type ComputedRef } from "vue"
import type { SessionArchives, SessionArchivesPatch } from "@/types/common-type.js"
import { getSessionArchives, patchSessionArchives } from "@client/platform.js"

const state = shallowRef<SessionArchives>({})
let hydrated = false
let inflight: Promise<void> | undefined
let deferredRemote: SessionArchives | undefined
let lastOptimisticNow = 0
let pendingOps = 0
let revision = 0
let chain: Promise<void> = Promise.resolve()
export const sessionArchives: ComputedRef<SessionArchives> = computed(() => state.value)
export const archivedSessionIds: ComputedRef<ReadonlySet<string>> = computed(
  () => new Set(Object.keys(state.value)),
)

export function resetSessionArchivesForTest(): void {
  state.value = {}
  hydrated = false
  inflight = undefined
  deferredRemote = undefined
  lastOptimisticNow = 0
  pendingOps = 0
  revision = 0
  chain = Promise.resolve()
}

function sameArchives(a: SessionArchives, b: SessionArchives): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => a[key] === b[key])
}

export async function hydrateSessionArchives(): Promise<void> {
  if (inflight) return inflight
  const startRevision = revision

  inflight = (async () => {
    try {
      const { archives } = await getSessionArchives()

      if (revision === startRevision && pendingOps === 0 && !sameArchives(state.value, archives)) {
        state.value = { ...archives }
      }

      hydrated = true
    } catch {
      return
    } finally {
      inflight = undefined
    }
  })()
  return inflight
}

export function applyRemoteSessionArchives(archives: SessionArchives): void {
  hydrated = true

  if (pendingOps > 0) {
    deferredRemote = { ...archives }
    return
  }

  deferredRemote = undefined

  if (sameArchives(state.value, archives)) return
  state.value = { ...archives }
}

export function removeArchivedSessionLocal(id: string): void {
  if (state.value[id] === undefined) return
  revision += 1
  const next = { ...state.value }

  delete next[id]
  state.value = next
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }

  return out
}

function applyPatchOptimistic(
  patch: SessionArchivesPatch,
  now: number,
): { rollback: () => void; changed: boolean } {
  const next = { ...state.value }
  const addedIds: string[] = []
  const removedEntries: Array<[string, number]> = []

  for (const id of patch.archive ?? []) {
    if (next[id] === undefined) {
      next[id] = now
      addedIds.push(id)
    }
  }

  for (const id of patch.unarchive ?? []) {
    const previous = next[id]

    if (previous !== undefined) {
      removedEntries.push([id, previous])
      delete next[id]
    }
  }

  const changed = addedIds.length > 0 || removedEntries.length > 0

  if (changed) state.value = next

  const rollback = () => {
    const reverted = { ...state.value }

    for (const id of addedIds) {
      if (reverted[id] === now) delete reverted[id]
    }

    for (const [id, ts] of removedEntries) {
      if (reverted[id] === undefined) reverted[id] = ts
    }

    state.value = reverted
  }

  return { rollback, changed }
}

async function commitPatch(patch: SessionArchivesPatch): Promise<void> {
  const archive = uniqueIds(patch.archive ?? [])
  const unarchive = uniqueIds(patch.unarchive ?? [])

  if (archive.length === 0 && unarchive.length === 0) return

  const payload: SessionArchivesPatch = {
    ...(archive.length > 0 ? { archive } : {}),
    ...(unarchive.length > 0 ? { unarchive } : {}),
  }
  const myRevision = ++revision
  const now = Math.max(Date.now(), lastOptimisticNow + 1)

  lastOptimisticNow = now
  const { rollback, changed } = applyPatchOptimistic(payload, now)

  if (!changed && hydrated) return
  pendingOps += 1

  const run = chain.then(async () => {
    const server = await patchSessionArchives(payload)

    hydrated = true
    deferredRemote = undefined

    if (revision === myRevision) state.value = { ...server }
  })

  chain = run.catch(() => undefined)
  let failed = false

  try {
    await run
  } catch (error) {
    failed = true
    rollback()
    throw error
  } finally {
    pendingOps -= 1

    if (failed && pendingOps === 0 && deferredRemote !== undefined) {
      state.value = deferredRemote
      deferredRemote = undefined
    }
  }
}

export function archiveSessions(ids: readonly string[]): Promise<void> {
  return commitPatch({ archive: [...ids] })
}

export function unarchiveSessions(ids: readonly string[]): Promise<void> {
  return commitPatch({ unarchive: [...ids] })
}
