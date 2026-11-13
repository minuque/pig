import { inject, provide, shallowRef, type InjectionKey } from "vue"
import { readFlag, writeFlag } from "@utils/storage.js"
import { openTaskSessionKey } from "@features/transcript-view/index.js"
import {
  moveShown,
  readRailLayout,
  writeRailLayout,
  type RailLayout,
  type RailSectionId,
} from "@features/session-rail/lib/sections.js"

/** 打开中的子会话：只读抽屉显示它的完整过程。 */
export interface OpenChild {
  sessionId: string
  agent: string
}

const DOCKED_KEY = "pig.rail.docked"

function useSessionRailState() {
  const child = shallowRef<OpenChild>()
  const layout = shallowRef<RailLayout>(readRailLayout())
  const docked = shallowRef(readFlag(DOCKED_KEY))
  const toggled = (list: RailSectionId[], id: RailSectionId) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id]

  function update(patch: Partial<RailLayout>) {
    layout.value = { ...layout.value, ...patch }
    writeRailLayout(layout.value)
  }

  return {
    child,
    openChild(next: OpenChild) {
      child.value = next
    },
    closeChild() {
      child.value = undefined
    },
    /** 宽屏常驻面板开着与否；跨会话记住。 */
    docked,
    toggleDocked() {
      docked.value = !docked.value
      writeFlag(DOCKED_KEY, docked.value)
    },
    /** 常驻面板与窄屏浮层共用一份排列。 */
    layout,
    toggleOpen(id: RailSectionId) {
      update({ closed: toggled(layout.value.closed, id) })
    },
    setAllOpen(open: boolean) {
      update({ closed: open ? [] : [...layout.value.order] })
    },
    toggleHidden(id: RailSectionId) {
      update({ hidden: toggled(layout.value.hidden, id) })
    },
    move(shown: readonly RailSectionId[], id: RailSectionId, toIndex: number) {
      update({ order: moveShown(layout.value.order, shown, id, toIndex) })
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

/** 面板自己的状态；不在面板树里时返回 undefined。 */
export function useSessionRail(): SessionRailContext | undefined {
  return inject(key, undefined)
}
