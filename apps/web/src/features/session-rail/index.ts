import { inject, provide, shallowRef, type InjectionKey } from "vue"

/** 打开中的子会话：只读抽屉显示它的完整过程。 */
export interface OpenChild {
  sessionId: string
  agent: string
}

function useSessionRailState() {
  const child = shallowRef<OpenChild>()
  return {
    child,
    openChild(next: OpenChild) {
      child.value = next
    },
    closeChild() {
      child.value = undefined
    },
  }
}

export type SessionRailContext = ReturnType<typeof useSessionRailState>

const key: InjectionKey<SessionRailContext> = Symbol("session-rail")

export function provideSessionRail() {
  const state = useSessionRailState()
  provide(key, state)
  return state
}

/** 时间线里的子任务卡片用它打开抽屉；不在面板树里时返回 undefined。 */
export function useSessionRail(): SessionRailContext | undefined {
  return inject(key, undefined)
}
