import { inject, provide, shallowRef, type InjectionKey } from "vue"
import { readFlag, writeFlag } from "@utils/storage.js"
import { openTaskSessionKey } from "@features/transcript-view/index.js"
import type { ContextUsageSegment } from "@features/composer/type.js"
import { dismissTasks, readDismissed } from "@features/session-rail/lib/task-list.js"
import {
  moveShown,
  readRailLayout,
  writeRailLayout,
  type RailLayout,
  type RailSectionId,
} from "@features/session-rail/lib/sections.js"

/** 打开中的子会话：面板里只读显示它的完整过程。 */
export interface OpenChild {
  sessionId: string
  agent: string
}

/** 右侧面板正在显示的内容；点摘要卡里的条目都在这里展开。 */
export type RailPane =
  | { kind: "tasks"; focus?: string | undefined }
  | { kind: "child"; child: OpenChild }
  | { kind: "context"; segment: ContextUsageSegment }

const DOCKED_KEY = "pig.rail.docked"

function useSessionRailState() {
  const pane = shallowRef<RailPane>()
  const paneWide = shallowRef(false)
  /** 面板内容所属的会话；回到同一会话时面板照旧开着。 */
  let paneOwner: string | undefined
  /** 当前会话里清除过的已结束任务 id。 */
  const dismissed = shallowRef<string[]>([])
  const layout = shallowRef<RailLayout>(readRailLayout())
  const docked = shallowRef(readFlag(DOCKED_KEY))
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
    paneWide,
    openPane,
    openChild(child: OpenChild) {
      openPane({ kind: "child", child })
    },
    closePane() {
      pane.value = undefined
    },
    toggleWide() {
      paneWide.value = !paneWide.value
    },
    /** 进入会话：面板里是别的会话的内容就收起；清除记录按会话读。 */
    enterSession(sessionId: string | undefined) {
      if (sessionId !== paneOwner) pane.value = undefined
      paneOwner = sessionId
      dismissed.value = sessionId ? readDismissed(sessionId) : []
    },
    dismissed,
    dismiss(sessionId: string, ids: readonly string[]) {
      if (ids.length) dismissed.value = dismissTasks(sessionId, ids)
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
