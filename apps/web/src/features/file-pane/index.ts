import { computed, inject, provide, shallowRef, watch, type InjectionKey } from "vue"
import { readPref, writePref } from "@utils/storage.js"
import type { SessionContext } from "@features/session/index.js"
import { openFileKey } from "@features/transcript-view/index.js"
import {
  closeTab,
  emptyTabs,
  openTab,
  pinTab,
  readSessionTabs,
  writeSessionTabs,
  type TabsState,
} from "@features/file-pane/lib/tabs.js"

/** 一次打开请求：查看器据此滚到行、标出范围；seq 让同一位置也能再跳一次。 */
export interface FileRequest {
  path: string
  line?: number | undefined
  endLine?: number | undefined
  seq: number
}

export interface OpenOptions {
  line?: number | undefined
  endLine?: number | undefined
  pin?: boolean
}

const OPEN_KEY = "pig.files.open"

function useFilePaneState(session: Pick<SessionContext, "sessionId" | "sessionCwd">) {
  const open = shallowRef(readPref(OPEN_KEY) === "on")
  const tabs = shallowRef<TabsState>(emptyTabs())
  const request = shallowRef<FileRequest>()
  /** 被 agent 改过的文件：计数变了查看器就重读。 */
  const revisions = shallowRef<Record<string, number>>({})
  const cwd = computed(() => session.sessionCwd.value)
  let seq = 0

  watch(
    session.sessionId,
    (id) => {
      tabs.value = id ? readSessionTabs(id) : emptyTabs()
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
    open.value = next
    writePref(OPEN_KEY, next ? "on" : "off")
  }

  function openFile(path: string, options: OpenOptions = {}) {
    update(openTab(tabs.value, path, options.pin ?? false))
    request.value = { path, line: options.line, endLine: options.endLine, seq: ++seq }
    setOpen(true)
  }

  return {
    open,
    tabs,
    request,
    revisions,
    cwd,
    openFile,
    setOpen,
    toggle: () => setOpen(!open.value),
    activate: (path: string) => update(openTab(tabs.value, path, false)),
    pin: (path: string) => update(pinTab(tabs.value, path)),
    close: (path: string) => update(closeTab(tabs.value, path)),
    invalidate(path: string) {
      revisions.value = { ...revisions.value, [path]: (revisions.value[path] ?? 0) + 1 }
    },
  }
}

export type FilePaneContext = ReturnType<typeof useFilePaneState>

const key: InjectionKey<FilePaneContext> = Symbol("file-pane")

export function provideFilePane(session: Pick<SessionContext, "sessionId" | "sessionCwd">) {
  const state = useFilePaneState(session)
  provide(key, state)
  provide(openFileKey, ({ path, line, endLine }) => state.openFile(path, { line, endLine }))
  return state
}

export function useFilePane(): FilePaneContext {
  const state = inject(key)

  if (!state) throw new Error("useFilePane() 需要先 provideFilePane()")
  return state
}
