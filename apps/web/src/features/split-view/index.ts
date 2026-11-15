import { computed, inject, provide, shallowRef, watch, type InjectionKey, type Ref } from "vue"
import { readPref, writePref } from "@utils/storage.js"
import type { SessionContext } from "@features/session/index.js"
import { useSplitRoute } from "@features/split-view/hooks/use-split-route.js"
import {
  closeSide,
  fitsSplit,
  focusSide,
  openInFocused,
  openToSide,
  parseSplit,
  serializeSplit,
  setRatio,
  type Side,
  type SplitState,
} from "@features/split-view/lib/split-state.js"

export type { Side, SplitState } from "@features/split-view/lib/split-state.js"

const STORAGE_KEY = "pig.split"

function createSplitView(
  route: Readonly<Ref<string | undefined>>,
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
    setWidth: (value: number) => {
      width.value = value
    },
    openInFocused: (id: string | undefined) => update((s) => openInFocused(s, id)),
    openToSide: (id: string | undefined) => update((s) => openToSide(s, id)),
    focusSide: (side: Side) => update((s) => focusSide(s, side)),
    closeSide: (side: Side) => update((s) => closeSide(s, side)),
    setRatio: (ratio: number) => update((s) => setRatio(s, ratio)),
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

export function useSplitView(): SplitViewContext {
  const split = inject(key)

  if (!split) throw new Error("useSplitView() 需要先 provideSplitView()")
  return split
}

/** 聚焦那一侧的会话视图：给 sidebar、扩展弹窗这些全局只认一个会话的地方用。 */
export function focusedSession(read: () => SessionContext) {
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
    backgroundRunningIds: computed(() => read().backgroundRunningIds.value),
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
