import {
  shouldLoadOlderTranscript,
  transcriptOverflows,
} from "@features/transcript-view/lib/transcript-scroll.js"

const LOAD_OLDER_TOP = 48

/** 上翻到顶拉更早一页；贴底、加载中或已经请求过就不重复拉。 */
export function useTranscriptOlder(options: {
  hasMore: () => boolean
  loading: () => boolean
  getRoot: () => HTMLElement | null
  isAtBottom: () => boolean
  load: () => void
}) {
  let armed = true

  function request() {
    if (!options.hasMore() || options.loading()) return
    armed = false
    options.load()
  }

  function onScroll() {
    const root = options.getRoot()
    const top = root?.scrollTop ?? 0

    if (top > LOAD_OLDER_TOP) armed = true

    if (!armed) return
    const overflow = transcriptOverflows(root?.scrollHeight ?? 0, root?.clientHeight ?? 0)

    if (
      !shouldLoadOlderTranscript(options.hasMore(), options.loading(), options.isAtBottom(), top, {
        threshold: LOAD_OLDER_TOP,
        overflow,
      })
    )
      return
    request()
  }

  return { request, onScroll, arm: () => (armed = true) }
}
