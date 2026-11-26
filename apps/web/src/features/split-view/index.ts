import { computed, inject, provide, shallowRef, type InjectionKey, type Ref } from "vue"
import type { SessionContext } from "@features/session/index.js"
import { useSplitRoute } from "@features/split-view/hooks/use-split-route.js"
import { routeAlert, type AlertRoute, type PaneAlert } from "@features/split-view/lib/pane-alert.js"
import {
  closeSide,
  emptySplit,
  fitsSplit,
  focusSide,
  leaveSession,
  newOnRight,
  openInFocused,
  openToSide,
  setRatio,
  setView,
  stepView,
  type PaneView,
  type Side,
  type SplitState,
} from "@features/split-view/lib/split-state.js"

export type { PaneView, Side, SplitState } from "@features/split-view/lib/split-state.js"

export { PANE_VIEWS } from "@features/split-view/lib/split-state.js"

export type { PaneAlert } from "@features/split-view/lib/pane-alert.js"

export { ALERT_TTL } from "@features/split-view/lib/pane-alert.js"

function createSplitView(
  route: Readonly<Ref<string | undefined | null>>,
  go: (id: string | undefined) => void,
) {
  const state = shallowRef<SplitState>(emptySplit)
  const width = shallowRef(Number.POSITIVE_INFINITY)
  const update = (next: (current: SplitState) => SplitState) => {
    state.value = next(state.value)
  }

  useSplitRoute(state, route, go)
  return {
    state,
    alerts: createPaneAlerts(state),
    split: computed(() => state.value.split),
    focused: computed(() => state.value.focused),
    fits: computed(() => fitsSplit(width.value)),
    setWidth: (value: number) => {
      width.value = value

      if (state.value.split) update((s) => setRatio(s, s.ratio, value))
    },
    openInFocused: (id: string | undefined) => update((s) => openInFocused(s, id)),
    openToSide: (id: string | undefined) => update((s) => openToSide(s, id)),
    focusSide: (side: Side) => update((s) => focusSide(s, side)),
    closeSide: (side: Side) => update((s) => closeSide(s, side)),
    newOnRight: () => update(newOnRight),
    leaveSession: (id: string) => update((s) => leaveSession(s, id)),
    setRatio: (ratio: number) => update((s) => setRatio(s, ratio, width.value)),
    showIn: (side: Side, id: string) => update((s) => ({ ...s, [side]: id, focused: side })),
    view: (side: Side) => state.value.views[side],
    showView: (side: Side, view: PaneView) => update((s) => setView(s, side, view)),
    stepView: (side: Side, delta: number) => update((s) => stepView(s, side, delta)),
  }
}

export type SplitViewContext = ReturnType<typeof createSplitView>

const key: InjectionKey<SplitViewContext> = Symbol("split-view")

export function provideSplitView(...args: Parameters<typeof createSplitView>) {
  const split = createSplitView(...args)
  provide(key, split)
  return split
}

export function trySplitView(): SplitViewContext | undefined {
  return inject(key, undefined)
}

export function useSplitView(): SplitViewContext {
  const split = inject(key)

  if (!split) throw new Error("useSplitView() 需要先 provideSplitView()")
  return split
}

export function focusedSession(
  read: () => SessionContext,
  readOther: () => SessionContext,
  leave: (id: string) => void,
) {
  const otherId = () => {
    const other = readOther()
    return other === read() ? undefined : other.sessionId.value
  }

  return {
    sessionId: computed(() => read().sessionId.value),
    projection: computed(() => read().projection.value),
    transcript: computed(() => read().transcript.value),
    prompt: computed({
      get: () => read().prompt.value,
      set: (value: string) => {
        read().prompt.value = value
      },
    }),
    backgroundRunningIds: computed(() => {
      const ids = read().backgroundRunningIds.value
      const id = otherId()

      if (!id || !readOther().projection.value?.running || ids.has(id)) return ids
      return new Set([...ids, id])
    }),
    shownIds: computed(() => [read().sessionId.value, otherId()]),
    leave,
    loadHistory: (id: string, options?: { force?: boolean }) => read().loadHistory(id, options),
  }
}

export type FocusedSession = ReturnType<typeof focusedSession>

const sideKey: InjectionKey<Side> = Symbol("pane-side")

export function providePaneSide(side: Side) {
  provide(sideKey, side)
}

export function usePaneSide(): Side {
  return inject(sideKey, "left")
}

function createPaneAlerts(state: Readonly<Ref<SplitState>>) {
  const queues = shallowRef<Record<Side, readonly PaneAlert[]>>({ left: [], right: [] })
  const shownSide = (id: string) => {
    if (state.value.left === id) return "left"
    return state.value.split && state.value.right === id ? "right" : undefined
  }

  function push(side: Side, alert: PaneAlert) {
    queues.value = { ...queues.value, [side]: [...queues.value[side], alert] }
  }

  return {
    current: (side: Side) => queues.value[side][0],
    pending: (side: Side) => Math.max(0, queues.value[side].length - 1),
    dismiss(side: Side) {
      queues.value = { ...queues.value, [side]: queues.value[side].slice(1) }
    },
    clear(side: Side) {
      queues.value = { ...queues.value, [side]: [] }
    },
    route(sessionId: string, alert: PaneAlert): AlertRoute {
      const side = shownSide(sessionId)
      const route = routeAlert(alert.kind, side && state.value.views[side])

      if (side && route === "island") push(side, alert)
      return route
    },
  }
}

export type PaneAlerts = ReturnType<typeof createPaneAlerts>
