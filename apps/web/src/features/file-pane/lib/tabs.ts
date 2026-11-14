import { readPref, writePref, type PrefStorage } from "@utils/storage.js"

/** 一个打开的文件；preview 是单击打开的临时标签，下一次单击会替换它。 */
export interface FileTab {
  path: string
  preview: boolean
}

export interface TabsState {
  tabs: FileTab[]
  active?: string | undefined
}

const TABS_KEY = "pig.files.tabs"
/** 与 cc-wrapper 的会话布局记忆同一上限：超出时最久没用的先丢。 */
const MAX_SESSIONS = 100
export const emptyTabs = (): TabsState => ({ tabs: [] })

export function openTab(state: TabsState, path: string, pin: boolean): TabsState {
  const index = state.tabs.findIndex((tab) => tab.path === path)

  if (index >= 0) {
    const tabs = pin
      ? state.tabs.map((tab, i) => (i === index ? { path, preview: false } : tab))
      : state.tabs
    return { tabs, active: path }
  }

  const tab = { path, preview: !pin }
  const previewAt = state.tabs.findIndex((item) => item.preview)
  const tabs =
    !pin && previewAt >= 0
      ? state.tabs.map((item, i) => (i === previewAt ? tab : item))
      : [...state.tabs, tab]
  return { tabs, active: path }
}

export function pinTab(state: TabsState, path: string): TabsState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.path === path ? { path, preview: false } : tab)),
  }
}

export function closeTab(state: TabsState, path: string): TabsState {
  const index = state.tabs.findIndex((tab) => tab.path === path)

  if (index < 0) return state

  const tabs = state.tabs.filter((_, i) => i !== index)

  if (!tabs.length) return emptyTabs()

  const active = state.active === path ? tabs[Math.min(index, tabs.length - 1)]!.path : state.active
  return { tabs, active }
}

type Stored = Record<string, TabsState>

function readAll(storage: PrefStorage): Stored {
  try {
    const value: unknown = JSON.parse(readPref(TABS_KEY, storage) ?? "{}")
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Stored) : {}
  } catch {
    return {}
  }
}

function valid(state: unknown): state is TabsState {
  if (!state || typeof state !== "object") return false

  const { tabs } = state as TabsState
  return (
    Array.isArray(tabs) &&
    tabs.every((tab) => typeof tab?.path === "string" && typeof tab.preview === "boolean")
  )
}

export function readSessionTabs(sessionId: string, storage: PrefStorage = localStorage): TabsState {
  const state = readAll(storage)[sessionId]

  if (!valid(state)) return emptyTabs()
  return state.tabs.length ? { tabs: state.tabs, active: state.active } : emptyTabs()
}

/** 只记路径与临时标记，不记内容；最近写的会话排在最后。 */
export function writeSessionTabs(
  sessionId: string,
  state: TabsState,
  storage: PrefStorage = localStorage,
): void {
  const all = readAll(storage)
  delete all[sessionId]

  if (state.tabs.length) all[sessionId] = { tabs: state.tabs, active: state.active }

  const kept = Object.entries(all).slice(-MAX_SESSIONS)
  writePref(TABS_KEY, JSON.stringify(Object.fromEntries(kept)), storage)
}
