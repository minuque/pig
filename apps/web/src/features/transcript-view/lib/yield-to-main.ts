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
export function yieldToMain(): Promise<void> {
  const api = scheduler()

  if (api?.yield) return api.yield()

  if (api?.postTask) return api.postTask(() => undefined)
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/** 低于输入优先级，揭开后挂 Markdown 用这个。 */
export function yieldToBackground(): Promise<void> {
  const api = scheduler()

  if (api?.postTask) return api.postTask(() => undefined, { priority: "background" })
  return yieldToMain()
}

export function inputPending(): boolean {
  const scheduling = (
    globalThis as {
      navigator?: {
        scheduling?: { isInputPending?: (opts?: { includeContinuous?: boolean }) => boolean }
      }
    }
  ).navigator?.scheduling
  return scheduling?.isInputPending?.({ includeContinuous: true }) === true
}
