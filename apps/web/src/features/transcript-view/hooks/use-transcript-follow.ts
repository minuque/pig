import { onBeforeUnmount, shallowRef } from "vue"
import {
  isTranscriptAtBottom,
  isTranscriptVisuallyAtBottom,
} from "@features/transcript-view/lib/transcript-scroll.js"

export type TranscriptScrollBehavior = "auto" | "smooth"

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function userScrollBehavior(): TranscriptScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth"
}

/** 内容增高时按帧跟随；用户上翻立即停，首次打开和减少动态效果直接贴底。 */
export function useTranscriptFollow(getRoot: () => HTMLElement | null) {
  const atBottom = shallowRef(false)
  const visuallyAtBottom = shallowRef(false)
  let navigating = false
  let navRoot: HTMLElement | null = null
  let onNavEnd: (() => void) | null = null
  let navTimer = 0
  let lastWritten = 0
  let applying = false

  function stopFollow() {
    lastWritten = 0
  }

  function writeScrollTop(root: HTMLElement, top: number) {
    applying = true
    root.scrollTop = top
    applying = false
  }

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
    lastWritten = 0

    if (root.scrollTop > 0.5) writeScrollTop(root, 0)
    lastWritten = root.scrollTop
    visuallyAtBottom.value = true
  }

  function releasePinnedToBottom() {
    stopFollow()
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
    if (applying || navigating || !atBottom.value) return
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
    releasePinnedToBottom()
    atBottom.value = false
    visuallyAtBottom.value = false
  }

  function onScroll() {
    if (applying) return
    const root = getRoot()

    if (!root || navigating) return

    if (atBottom.value) {
      if (root.scrollTop > 2) {
        stopFollow()
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
    lastWritten = 0
    const instant = behavior === "auto" || prefersReducedMotion()

    if (instant || root.scrollTop <= 2) {
      releasePinnedToBottom()
      jumpToBottom()
      return
    }

    beginNavigate(root)
    root.scrollTo({ top: 0, behavior: "smooth" })
  }

  function scrollToElement(el: HTMLElement) {
    const root = getRoot()
    atBottom.value = false
    visuallyAtBottom.value = false

    if (root) beginNavigate(root)
    el.scrollIntoView({ block: "start", behavior: userScrollBehavior() })
  }

  onBeforeUnmount(releasePinnedToBottom)
  return {
    atBottom,
    visuallyAtBottom,
    pinIfNeeded,
    releasePinnedToBottom,
    reset,
    onScroll,
    onWheel,
    scrollToLatest,
    scrollToElement,
  }
}
