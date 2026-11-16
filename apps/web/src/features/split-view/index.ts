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
  /** 主区宽度：放不下两侧时只显示聚焦的一侧。 */
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
    /** 两侧能并排放下。 */
    fits: computed(() => fitsSplit(width.value)),
    /** 主区变窄时把已存的比例收回到两侧都放得下的范围。 */
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
    /** 这一侧建出新会话：显示它并聚焦这一侧。 */
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

/** 不在壳层里（如设计页）时拿不到分屏，返回 undefined。 */
export function trySplitView(): SplitViewContext | undefined {
  return inject(key, undefined)
}

export function useSplitView(): SplitViewContext {
  const split = inject(key)

  if (!split) throw new Error("useSplitView() 需要先 provideSplitView()")
  return split
}

/** 聚焦那一侧的会话视图：给 sidebar、扩展弹窗这些全局只认一个会话的地方用。
 * 在跑与在显示两件事要算上另一侧：另一侧的前台会话不在后台池里。 */
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
    /** 哪一侧显示着这个会话，就让那一侧回到新会话页。 */
    leave,
    loadHistory: (id: string, options?: { force?: boolean }) => read().loadHistory(id, options),
  }
}

export type FocusedSession = ReturnType<typeof focusedSession>

const sideKey: InjectionKey<Side> = Symbol("pane-side")

/** 一侧 workbench 的子树知道自己在哪一侧。 */
export function providePaneSide(side: Side) {
  provide(sideKey, side)
}

export function usePaneSide(): Side {
  return inject(sideKey, "left")
}

/** 一侧 workbench 的面板列：各面板按打开顺序登记，列给每个放得下的面板一个挂载点。 */
function createPanelHost() {
  const order = shallowRef<PanelKind[]>([])
  const height = shallowRef(Number.POSITIVE_INFINITY)
  const slots = shallowReactive(new Map<PanelKind, HTMLElement>())
  /** 面板列宽度不够时整列盖住对话。 */
  const covering = shallowRef(false)
  const visible = computed(() => visiblePanels(order.value, height.value))
  return {
    order,
    visible,
    covering,
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
    /** 被收起的面板点回来：挪到最下面，成为最新打开的。 */
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
