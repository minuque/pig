import {
  computed,
  inject,
  provide,
  shallowReactive,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref,
} from "vue"
import { readPref, writePref } from "@utils/storage.js"
import type { SessionContext } from "@features/session/index.js"
import { useSplitRoute } from "@features/split-view/hooks/use-split-route.js"
import {
  closePanel,
  openPanel,
  visiblePanels,
  type PanelKind,
} from "@features/split-view/lib/panel-stack.js"
import {
  closeSide,
  fitsSplit,
  focusSide,
  leaveSession,
  newOnRight,
  openInFocused,
  openToSide,
  parseSplit,
  serializeSplit,
  setRatio,
  type Side,
  type SplitState,
} from "@features/split-view/lib/split-state.js"

export type { Side, SplitState } from "@features/split-view/lib/split-state.js"

export type { PanelKind } from "@features/split-view/lib/panel-stack.js"

const STORAGE_KEY = "pig.split"

function createSplitView(
  route: Readonly<Ref<string | undefined | null>>,
  go: (id: string | undefined) => void,
) {
  const state = shallowRef<SplitState>(parseSplit(readPref(STORAGE_KEY)))
  const width = shallowRef(Number.POSITIVE_INFINITY)
  const update = (next: (current: SplitState) => SplitState) => {
    state.value = next(state.value)
  }

  watch(state, (value) => writePref(STORAGE_KEY, serializeSplit(value)))
  useSplitRoute(state, route, go)
  return {
    state,
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

function createPanelHost() {
  const order = shallowRef<PanelKind[]>([])
  const height = shallowRef(Number.POSITIVE_INFINITY)
  const slots = shallowReactive(new Map<PanelKind, HTMLElement>())
  const covering = shallowRef(false)
  const narrow = shallowRef(false)
  const expanded = shallowRef(false)
  const visible = computed(() => visiblePanels(order.value, height.value))
  return {
    order,
    visible,
    covering,
    narrow,
    expanded,
    slots,
    setHeight: (value: number) => {
      height.value = value
    },
    open: (kind: PanelKind) => {
      order.value = openPanel(order.value, kind)
    },
    close: (kind: PanelKind) => {
      order.value = closePanel(order.value, kind)
    },
    raise: (kind: PanelKind) => {
      order.value = [...closePanel(order.value, kind), kind]
    },
    hidden: (kind: PanelKind) => order.value.includes(kind) && !visible.value.includes(kind),
  }
}

export type PanelHost = ReturnType<typeof createPanelHost>

const panelHostKey: InjectionKey<PanelHost> = Symbol("panel-host")

export function providePanelHost() {
  const host = createPanelHost()
  provide(panelHostKey, host)
  return host
}

export function usePanelHost(): PanelHost | undefined {
  return inject(panelHostKey, undefined)
}
