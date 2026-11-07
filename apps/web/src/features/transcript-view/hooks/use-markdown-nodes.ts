import { onBeforeUnmount, shallowRef, watch, type ShallowRef } from "vue"
import type { Node } from "comark"
import {
  cachedFinalNodes,
  createStreamParser,
  storeFinalNodes,
} from "@features/transcript-view/lib/markdown-parse.js"
import {
  REVEAL_SETTLE_MS,
  createResponseReveal,
} from "@features/transcript-view/lib/response-reveal.js"

type Source = { text: () => string; streaming: () => boolean; cacheKey: () => string }

/** 正文 → Comark 节点。流式每帧最多解析一次，只重解析末段；终态按消息缓存。 */
export function useMarkdownNodes(source: Source): ShallowRef<Node[]> {
  const parse = createStreamParser()
  const nodes = shallowRef<Node[]>(cachedFinalNodes(source.cacheKey(), source.text()) ?? [])
  let reveal = source.streaming() ? createResponseReveal(source.text()) : null
  let frame = 0
  let dirty = false
  let settle: ReturnType<typeof setTimeout> | undefined
  let seq = 0
  let disposed = false

  async function run() {
    const id = ++seq
    const text = source.text()
    const key = source.cacheKey()
    const streaming = source.streaming()
    const hit = streaming ? null : cachedFinalNodes(key, text)
    const parsed = hit ?? (await parse(text, { streaming })).nodes

    if (disposed || id !== seq) return

    if (!streaming && !hit) storeFinalNodes(key, text, parsed)

    if (!reveal) {
      nodes.value = parsed
      return
    }

    reveal.begin(text)
    nodes.value = reveal.decorate(parsed)

    if (!streaming && settle === undefined)
      settle = setTimeout(() => finishReveal(parsed), REVEAL_SETTLE_MS)
  }

  function finishReveal(parsed: Node[]) {
    reveal?.finish()
    reveal = null

    if (!disposed) nodes.value = parsed
  }

  // 帧首个更新立即解析，同帧后续更新合并到下一帧首，不额外推迟一帧。
  function schedule() {
    if (!source.streaming()) {
      void run()
      return
    }

    if (frame) {
      dirty = true
      return
    }

    void run()
    frame = requestAnimationFrame(() => {
      frame = 0

      if (dirty) {
        dirty = false
        schedule()
      }
    })
  }

  watch([source.text, source.streaming, source.cacheKey], schedule)

  if (!nodes.value.length) void run()

  onBeforeUnmount(() => {
    disposed = true

    if (frame) cancelAnimationFrame(frame)
    clearTimeout(settle)
  })
  return nodes
}
