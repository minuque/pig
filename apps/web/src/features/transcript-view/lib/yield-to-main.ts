type Scheduler = {
  yield?: () => Promise<void>
  postTask?: (fn: () => void) => Promise<void>
}

/** 把后续工作让给滚动和点击，有 scheduler.yield 就用。 */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: Scheduler }).scheduler

  if (scheduler?.yield) return scheduler.yield()

  if (scheduler?.postTask) return scheduler.postTask(() => undefined)
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
