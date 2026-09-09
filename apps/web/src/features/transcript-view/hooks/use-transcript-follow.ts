import { onBeforeUnmount, shallowRef } from "vue"
import {
  isTranscriptAtBottom,
  isTranscriptVisuallyAtBottom,
  transcriptFloorTop,
} from "@features/transcript-view/lib/transcript-scroll.js"

export type TranscriptScrollBehavior = "auto" | "smooth"

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function userScrollBehavior(): TranscriptScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth"
}

/** 贴底时内容增高立刻跟上；上翻才停。平滑滚动只用于用户点「回到底部」。 */
export function useTranscriptFollow(getRoot: () => HTMLElement | null) {
  const atBottom = shallowRef(false)
  const visuallyAtBottom = shallowRef(false)
  let navigating = false
  let holdingTail = false
  let holdRaf = 0
  let navRoot: HTMLElement | null = null
  let onNavEnd: (() => void) | null = null
  let navTimer = 0
  let lastWritten = 0

  function applyBottom(root: HTMLElement) {
    visuallyAtBottom.value = isTranscriptVisuallyAtBottom(
      root.scrollHeight,
      root.scrollTop,
      root.clientHeight,
    )
    if (isTranscriptAtBottom(root.scrollHeight, root.scrollTop, root.clientHeight)) {
      atBottom.value = true
      lastWritten = root.scrollTop
    }
  }

  function jumpToBottom() {
    const root = getRoot()
    if (!root) return
    const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)
    lastWritten = floor
    if (Math.abs(root.scrollTop - floor) > 0.5) root.scrollTop = floor
  }

  function releasePinnedToBottom() {
    navigating = false
    if (navTimer) {
      window.clearTimeout(navTimer)
      navTimer = 0
    }
    if (navRoot && onNavEnd) navRoot.removeEventListener("scrollend", onNavEnd)
    navRoot = null
    onNavEnd = null
  }

  function pinIfNeeded() {
    if (navigating) return
    if (holdingTail) {
      atBottom.value = true
      visuallyAtBottom.value = true
      jumpToBottom()
      return
    }
    if (!atBottom.value) return
    jumpToBottom()
  }

  function finishNavigate() {
    if (!navigating) return
    releasePinnedToBottom()
    const root = getRoot()
    if (root) applyBottom(root)
    if (atBottom.value) jumpToBottom()
  }

  function beginNavigate(root: HTMLElement) {
    releasePinnedToBottom()
    navigating = true
    navRoot = root
    onNavEnd = () => finishNavigate()
    root.addEventListener("scrollend", onNavEnd, { once: true })
    navTimer = window.setTimeout(finishNavigate, 1000) // ponytail: 无 scrollend 时收尾；动画超过 1s 会提前恢复跟随
  }

  function reset() {
    releaseTail()
    releasePinnedToBottom()
    atBottom.value = false
    visuallyAtBottom.value = false
  }

  function holdTail() {
    holdingTail = true
    if (holdRaf) return
    const tick = () => {
      if (!holdingTail) {
        holdRaf = 0
        return
      }
      atBottom.value = true
      visuallyAtBottom.value = true
      jumpToBottom()
      holdRaf = requestAnimationFrame(tick)
    }
    holdRaf = requestAnimationFrame(tick)
  }

  function releaseTail() {
    holdingTail = false
    if (holdRaf) {
      cancelAnimationFrame(holdRaf)
      holdRaf = 0
    }
  }

  function onScroll() {
    const root = getRoot()
    if (!root || navigating || holdingTail) return
    if (atBottom.value) {
      if (root.scrollTop + 2 < lastWritten) {
        atBottom.value = false
        visuallyAtBottom.value = isTranscriptVisuallyAtBottom(
          root.scrollHeight,
          root.scrollTop,
          root.clientHeight,
        )
        return
      }
      visuallyAtBottom.value = true
      return
    }
    applyBottom(root)
  }

  function onWheel(event: WheelEvent) {
    releaseTail()
    releasePinnedToBottom()
    if (event.deltaY < 0) atBottom.value = false
    const root = getRoot()
    if (!root) return
    const onScroller = event.target instanceof Node && root.contains(event.target)
    if (onScroller || event.deltaY === 0) return
    event.preventDefault()
    root.scrollTop += event.deltaY
  }

  function scrollToLatest(behavior: TranscriptScrollBehavior = "auto") {
    atBottom.value = true
    visuallyAtBottom.value = true
    const root = getRoot()
    if (!root) return
    const top = transcriptFloorTop(root.scrollHeight, root.clientHeight)
    lastWritten = top
    const instant = behavior === "auto" || prefersReducedMotion()
    if (instant || Math.abs(root.scrollTop - top) <= 2) {
      releasePinnedToBottom()
      jumpToBottom()
      return
    }
    beginNavigate(root)
    root.scrollTo({ top, behavior: "smooth" })
  }

  function scrollToElement(el: HTMLElement) {
    const root = getRoot()
    atBottom.value = false
    visuallyAtBottom.value = false
    if (root) beginNavigate(root)
    el.scrollIntoView({ block: "start", behavior: userScrollBehavior() })
  }

  onBeforeUnmount(() => {
    releaseTail()
    releasePinnedToBottom()
  })

  return {
    atBottom,
    visuallyAtBottom,
    pinIfNeeded,
    holdTail,
    releaseTail,
    releasePinnedToBottom,
    reset,
    onScroll,
    onWheel,
    scrollToLatest,
    scrollToElement,
  }
}
