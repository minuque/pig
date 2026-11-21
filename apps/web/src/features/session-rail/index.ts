import { computed, inject, provide, shallowRef, type InjectionKey } from "vue"
import { readFlag, writeFlag } from "@utils/storage.js"
import { openTaskSessionKey } from "@features/transcript-view/index.js"
import { railModeOf } from "@features/session-rail/lib/layout.js"
import { dismissTasks, readDismissed } from "@features/session-rail/lib/task-list.js"
import {
  RAIL_SECTIONS,
  readRailLayout,
  writeRailLayout,
  type RailLayout,
  type RailSectionId,
} from "@features/session-rail/lib/sections.js"

export interface OpenChild {
  sessionId: string
  agent: string
}

export type RailPane =
  { kind: "tasks"; focus?: string | undefined } | { kind: "child"; child: OpenChild }

const DOCKED_KEY = "pig.rail.docked"

function useSessionRailState() {
  const pane = shallowRef<RailPane>()
  let paneOwner: string | undefined
  const dismissed = shallowRef<string[]>([])
  const layout = shallowRef<RailLayout>(readRailLayout())
  const docked = shallowRef(readFlag(DOCKED_KEY))
  const width = shallowRef(window.innerWidth)
  const mode = computed(() => railModeOf(width.value))
  const dockedShown = computed(() => docked.value && mode.value === "docked")
  const toggled = (list: RailSectionId[], id: RailSectionId) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id]

  function update(patch: Partial<RailLayout>) {
    layout.value = { ...layout.value, ...patch }
    writeRailLayout(layout.value)
  }

  function openPane(next: RailPane) {
    pane.value = next
  }

  return {
    pane,
    openPane,
    openChild(child: OpenChild) {
      openPane({ kind: "child", child })
    },
    closePane() {
      pane.value = undefined
    },
    enterSession(sessionId: string | undefined) {
      if (sessionId !== paneOwner) pane.value = undefined
      paneOwner = sessionId
      dismissed.value = sessionId ? readDismissed(sessionId) : []
    },
    dismissed,
    dismiss(sessionId: string, ids: readonly string[]) {
      if (ids.length) dismissed.value = dismissTasks(sessionId, ids)
    },
    docked,
    dockedShown,
    mode,
    setWidth(next: number) {
      width.value = next
    },
    toggleDocked() {
      docked.value = !docked.value
      writeFlag(DOCKED_KEY, docked.value)
    },
    layout,
    toggleOpen(id: RailSectionId) {
      update({ closed: toggled(layout.value.closed, id) })
    },
    setAllOpen(open: boolean) {
      update({ closed: open ? [] : [...RAIL_SECTIONS] })
    },
    toggleHidden(id: RailSectionId) {
      update({ hidden: toggled(layout.value.hidden, id) })
    },
  }
}

export type SessionRailContext = ReturnType<typeof useSessionRailState>

const key: InjectionKey<SessionRailContext> = Symbol("session-rail")

export function provideSessionRail() {
  const state = useSessionRailState()
  provide(key, state)
  provide(openTaskSessionKey, state.openChild)
  return state
}

export function useSessionRail(): SessionRailContext | undefined {
  return inject(key, undefined)
}
