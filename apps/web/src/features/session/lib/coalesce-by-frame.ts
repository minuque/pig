/** 把高频回调合流到每帧最多发布一次，帧回调不可用时用超时兜底；cancel 丢弃未发布的值。 */
export function coalesceByFrame<T>(publish: (value: T) => void, fallbackMs = 32) {
  let pending: T | undefined
  let hasPending = false
  let scheduled = false

  function flush() {
    scheduled = false

    if (!hasPending) return
    const value = pending
    pending = undefined
    hasPending = false
    publish(value as T)
  }

  return {
    push(value: T) {
      pending = value
      hasPending = true

      if (scheduled) return
      scheduled = true
      let fired = false
      const run = () => {
        if (fired) return
        fired = true
        flush()
      }

      if (typeof requestAnimationFrame === "function") requestAnimationFrame(run)
      setTimeout(run, fallbackMs)
    },
    cancel() {
      pending = undefined
      hasPending = false
    },
  }
}
