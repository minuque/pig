import { computed, inject, nextTick, provide, shallowRef, watch, type InjectionKey } from "vue"
import { readFlag, readPref, writeFlag } from "@utils/storage.js"
import type { SessionContext } from "@features/session/index.js"
import { openFileKey } from "@features/transcript-view/index.js"
import { finishedWrites, workspacePath } from "@features/file-pane/lib/paths.js"
import { readSessionValue, writeSessionValue } from "@features/file-pane/lib/session-memory.js"
import {
  closeTab,
  emptyTabs,
  openTab,
  pinTab,
  readSessionTabs,
  writeSessionTabs,
  type TabsState,
} from "@features/file-pane/lib/tabs.js"

export interface FileRequest {
  path: string
  line?: number | undefined
  endLine?: number | undefined
  find?: string | undefined
  seq: number
}

export interface OpenOptions {
  line?: number | undefined
  endLine?: number | undefined
  find?: string | undefined
  pin?: boolean
}

const OPEN_KEY = "pig.files.open"
const TREE_KEY = "pig.files.tree"
const EXPANDED_KEY = "pig.files.expanded"
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string")

type SessionSource = Pick<SessionContext, "sessionId" | "sessionCwd" | "transcript">

function useFilePaneState(session: SessionSource) {
  const savedPref = readPref(OPEN_KEY)
  const saved = shallowRef(savedPref === undefined ? undefined : savedPref !== "off")
  const fits = shallowRef(true)
  const open = computed(() => saved.value ?? fits.value)
  const tabs = shallowRef<TabsState>(emptyTabs())
  const request = shallowRef<FileRequest>()
  const revisions = shallowRef<Record<string, number>>({})
  const changes = shallowRef(0)
  const treeShown = shallowRef(readFlag(TREE_KEY))
  const searchRequest = shallowRef(0)
  const expanded = shallowRef<string[]>([])
  const cwd = computed(() => session.sessionCwd.value)
  let seq = 0

  watch(
    session.sessionId,
    (id) => {
      tabs.value = id ? readSessionTabs(id) : emptyTabs()
      expanded.value = (id && readSessionValue(EXPANDED_KEY, id, isStringArray)) || []
      request.value = undefined
    },
    { immediate: true },
  )

  function update(next: TabsState) {
    tabs.value = next
    const id = session.sessionId.value

    if (id) writeSessionTabs(id, next)
  }

  function setOpen(next: boolean) {
    saved.value = next
    writeFlag(OPEN_KEY, next)
  }

  function openFile(path: string, options: OpenOptions = {}) {
    update(openTab(tabs.value, path, options.pin ?? false))
    request.value = {
      path,
      line: options.line,
      endLine: options.endLine,
      find: options.find,
      seq: ++seq,
    }
    setOpen(true)
  }

  let seen = new Set<string>()
  let seenSession: string | undefined

  watch(
    () => [session.transcript.value, cwd.value] as const,
    ([items, root]) => {
      const writes = root ? finishedWrites(root, items) : []
      const fresh = session.sessionId.value === seenSession
      seenSession = session.sessionId.value
      const opened = new Set(tabs.value.tabs.map((tab) => tab.path))
      const added = fresh ? writes.filter((write) => !seen.has(write.id)) : []

      for (const write of added) if (opened.has(write.path)) invalidate(write.path)

      if (added.length) changes.value += 1

      seen = new Set(writes.map((write) => write.id))
    },
    { immediate: true },
  )

  function invalidate(path: string) {
    revisions.value = { ...revisions.value, [path]: (revisions.value[path] ?? 0) + 1 }
  }

  return {
    open,
    tabs,
    request,
    revisions,
    cwd,
    openFile,
    setOpen,
    setFits: (next: boolean) => (fits.value = next),
    toggle: () => setOpen(!open.value),
    activate: (path: string) => update(openTab(tabs.value, path, false)),
    pin: (path: string) => update(pinTab(tabs.value, path)),
    close: (path: string) => update(closeTab(tabs.value, path)),
    changes,
    treeShown,
    toggleTree() {
      treeShown.value = !treeShown.value
      writeFlag(TREE_KEY, treeShown.value)
    },
    searchRequest,
    async focusSearch() {
      if (!treeShown.value) {
        treeShown.value = true
        writeFlag(TREE_KEY, true)
        await nextTick()
      }

      searchRequest.value += 1
    },
    expanded,
    setExpanded(next: string[]) {
      expanded.value = next
      const id = session.sessionId.value

      if (id) writeSessionValue(EXPANDED_KEY, id, next.length ? next : undefined)
    },
  }
}

export type FilePaneContext = ReturnType<typeof useFilePaneState>

const key: InjectionKey<FilePaneContext> = Symbol("file-pane")

export function provideFilePane(session: SessionSource) {
  const state = useFilePaneState(session)
  const resolve = (raw: string) =>
    state.cwd.value ? workspacePath(state.cwd.value, raw) : undefined

  provide(key, state)
  provide(openFileKey, {
    accepts: (raw) => Boolean(resolve(raw)),
    open({ path, line, endLine, find }) {
      const target = resolve(path)

      if (target)
        state.openFile(target.path, {
          line: line ?? target.line,
          endLine: endLine ?? target.endLine,
          find,
        })
    },
  })
  return state
}

export function useFilePane(): FilePaneContext {
  const state = inject(key)

  if (!state) throw new Error("useFilePane() 需要先 provideFilePane()")
  return state
}
