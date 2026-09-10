import { nextTick } from "vue"

function markdownNodeCount() {
  return document.querySelectorAll(".markstream-vue *").length
}

function nextFrame() {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve()
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/** 剩余节点与排队的 worker 在 loading 撤走前铺完。 */
export async function drainMarkdownAfterPaint() {
  await nextTick()
  const { flushMarkdownRuntime } = await import("@features/transcript-view/lib/markdown-runtime.js")
  await flushMarkdownRuntime()
  const start = performance.now()
  let last = -1
  let stable = 0
  while (performance.now() - start < 2500) {
    await nextFrame()
    const count = markdownNodeCount()
    if (count === last && count > 0) {
      stable += 1
      if (stable >= 18) return
    } else {
      stable = 0
      last = count
    }
  }
}
