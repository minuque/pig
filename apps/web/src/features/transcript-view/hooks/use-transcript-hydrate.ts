import { nextTick, onBeforeUnmount, shallowRef, watch, type Ref } from "vue"
import {
  isHighlighterReady,
  whenHighlighterReady,
} from "@features/transcript-view/lib/markdown-render-props.js"
import type { TimelineRow } from "@features/transcript-view/type.js"

type Scheduler = {
  yield?: () => Promise<void>
  postTask?: (
    fn: () => void,
    options?: { priority?: "user-blocking" | "user-visible" | "background" },
  ) => Promise<void>
}

function scheduler(): Scheduler | undefined {
  return (globalThis as { scheduler?: Scheduler }).scheduler
}

/** 把后续工作让给滚动和点击，有 scheduler.yield 就用。 */
function yieldToMain(): Promise<void> {
  const api = scheduler()

  if (api?.yield) return api.yield()

  if (api?.postTask) return api.postTask(() => undefined)
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/** 低于输入优先级，揭开后挂 Markdown 用这个。 */
function yieldToBackground(): Promise<void> {
  const api = scheduler()

  if (api?.postTask) return api.postTask(() => undefined, { priority: "background" })
  return yieldToMain()
}

function inputPending(): boolean {
  const scheduling = (
    globalThis as {
      navigator?: {
        scheduling?: { isInputPending?: (opts?: { includeContinuous?: boolean }) => boolean }
      }
    }
  ).navigator?.scheduling
  return scheduling?.isInputPending?.({ includeContinuous: true }) === true
}

/** 流式立刻画；历史等揭开、停稳、没有待处理输入。刚打开不算停稳。 */
function shouldHydrateHeavy(
  streaming: boolean,
  inView: boolean,
  scrollIdle: boolean,
  pendingInput = false,
): boolean {
  if (streaming) return true
  return inView && scrollIdle && !pendingInput
}

function nextHydrateId(
  rows: readonly { id: string; role: string; streaming?: boolean }[],
  hydrated: ReadonlySet<string>,
  inView: ReadonlySet<string>,
  scrollIdle: boolean,
  pendingInput = false,
): string | undefined {
  if (!scrollIdle || pendingInput) return undefined

  for (const row of rows) {
    if (row.role !== "assistant" || row.streaming || hydrated.has(row.id)) continue

    if (!shouldHydrateHeavy(false, inView.has(row.id), true, false)) continue
    return row.id
  }
}

/** 揭开并停稳后再挂可见助手 Markdown；刚打开和滚动中保持纯文本。 */
export function useTranscriptHydrate(
  rows: Ref<readonly TimelineRow[]>,
  scrollIdle: Ref<boolean>,
  getViewport: () => HTMLElement | null,
  readyFrame: Ref<boolean>,
) {
  const hydrated = shallowRef(new Set<string>())
  const inView = shallowRef(new Set<string>())
  const highlightReady = shallowRef(isHighlighterReady())
  let observer: IntersectionObserver | undefined
  let pumping = false
  let generation = 0

  if (!highlightReady.value) {
    void whenHighlighterReady().then(() => {
      highlightReady.value = true
    })
  }

  function mark(id: string) {
    if (hydrated.value.has(id)) return
    const next = new Set(hydrated.value)
    next.add(id)
    hydrated.value = next
  }

  function markStreaming() {
    for (const row of rows.value) {
      if (row.role === "assistant" && row.streaming) mark(row.id)
    }
  }

  function isHydrated(id: string) {
    return hydrated.value.has(id)
  }

  function peek(): string | undefined {
    if (!readyFrame.value) return undefined

    if (!highlightReady.value) {
      for (const row of rows.value) {
        if (row.role === "assistant" && row.streaming && !hydrated.value.has(row.id)) return row.id
      }

      return undefined
    }

    return nextHydrateId(rows.value, hydrated.value, inView.value, scrollIdle.value, inputPending())
  }

  function observe() {
    observer?.disconnect()
    const root = getViewport()

    if (!root) return
    observer = new IntersectionObserver(
      (entries) => {
        const next = new Set(inView.value)

        for (const entry of entries) {
          const id =
            entry.target instanceof HTMLElement ? entry.target.dataset.hydrateId : undefined

          if (!id) continue

          if (entry.isIntersecting) next.add(id)
          else next.delete(id)
        }

        inView.value = next
      },
      { root, threshold: 0 },
    )

    for (const node of root.querySelectorAll("[data-hydrate-id]")) observer.observe(node)
  }

  async function pump() {
    if (pumping) return
    pumping = true
    const mine = ++generation

    try {
      while (mine === generation) {
        if (!readyFrame.value || !scrollIdle.value) break
        const id = peek()

        if (!id) {
          if (inputPending()) {
            await yieldToBackground()
            continue
          }

          break
        }

        await yieldToBackground()

        if (mine !== generation || !readyFrame.value || !scrollIdle.value) break
        const next = peek()

        if (!next) continue
        mark(next)
        await yieldToMain()
      }
    } finally {
      if (mine === generation) pumping = false
    }
  }

  watch([readyFrame, rows, scrollIdle, inView, highlightReady], () => {
    markStreaming()
    void pump()
  })

  watch(
    rows,
    () => {
      void nextTick(observe)
    },
    { flush: "post" },
  )

  onBeforeUnmount(() => {
    generation += 1
    observer?.disconnect()
  })
  return { isHydrated, observe }
}
