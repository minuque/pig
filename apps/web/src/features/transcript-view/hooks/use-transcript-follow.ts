import { onBeforeUnmount, readonly, shallowRef } from "vue"
import {
  isTranscriptAtBottom,
  isTranscriptVisuallyAtBottom,
  unpinBottomScrollTop,
} from "@features/transcript-view/lib/transcript-scroll.js"

function userScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

/** 跟随则瞬间贴底；导航（回底部 / 小地图）期间不贴底，等 scrollend。 */
export function useTranscriptFollow(getRoot: () => HTMLElement | null) {
  const atBottom = shallowRef(false)
  const visuallyAtBottom = shallowRef(false)
  let navigating = false
  let navRoot: HTMLElement | null = null
  let onNavEnd: (() => void) | null = null
  let navTimer = 0

  function applyBottom(root: HTMLElement) {
    atBottom.value = isTranscriptAtBottom(root.scrollHeight, root.scrollTop, root.clientHeight)
    visuallyAtBottom.value = isTranscriptVisuallyAtBottom(
      root.scrollHeight,
      root.scrollTop,
      root.clientHeight,
    )
  }

  function jumpToBottom() {
    const root = getRoot()
    if (root) root.scrollTop = root.scrollHeight - root.clientHeight
  }

  function stopNavigating() {
    navigating = false
    if (navTimer) {
      window.clearTimeout(navTimer)
      navTimer = 0
    }
    if (navRoot && onNavEnd) navRoot.removeEventListener("scrollend", onNavEnd)
    navRoot = null
    onNavEnd = null
  }

  function finishNavigate() {
    if (!navigating) return
    stopNavigating()
    const root = getRoot()
    if (root) applyBottom(root)
    if (atBottom.value) jumpToBottom()
  }

  function beginNavigate(root: HTMLElement) {
    stopNavigating()
    navigating = true
    navRoot = root
    onNavEnd = () => finishNavigate()
    root.addEventListener("scrollend", onNavEnd, { once: true })
    navTimer = window.setTimeout(finishNavigate, 1000)
  }

  function pinIfNeeded() {
    if (navigating) return
    if (atBottom.value) jumpToBottom()
  }

  function releasePinnedToBottom() {
    stopNavigating()
  }

  function reset() {
    stopNavigating()
    atBottom.value = false
    visuallyAtBottom.value = false
  }

  function onScroll() {
    const root = getRoot()
    if (!root || navigating) return
    applyBottom(root)
  }

  function onWheel(event: WheelEvent) {
    stopNavigating()
    if (event.deltaY < 0) atBottom.value = false
    const root = getRoot()
    if (!root) return
    const nextTop = unpinBottomScrollTop(
      root.scrollHeight,
      root.scrollTop,
      root.clientHeight,
      event.deltaY,
    )
    if (nextTop !== null) {
      event.preventDefault()
      root.scrollTop = nextTop
      return
    }
    const onScroller = event.target instanceof Node && root.contains(event.target)
    if (onScroller || event.deltaY === 0) return
    event.preventDefault()
    root.scrollTop += event.deltaY
  }

  function scrollToLatest() {
    const root = getRoot()
    if (!root) return
    atBottom.value = true
    visuallyAtBottom.value = true
    const top = Math.max(0, root.scrollHeight - root.clientHeight)
    if (Math.abs(root.scrollTop - top) <= 2) {
      stopNavigating()
      jumpToBottom()
      return
    }
    beginNavigate(root)
    root.scrollTo({ top, behavior: userScrollBehavior() })
  }

  function scrollToElement(el: HTMLElement) {
    const root = getRoot()
    atBottom.value = false
    visuallyAtBottom.value = false
    if (root) beginNavigate(root)
    el.scrollIntoView({ block: "start", behavior: userScrollBehavior() })
  }

  onBeforeUnmount(stopNavigating)

  return {
    atBottom: readonly(atBottom),
    visuallyAtBottom: readonly(visuallyAtBottom),
    pinIfNeeded,
    releasePinnedToBottom,
    reset,
    onScroll,
    onWheel,
    scrollToLatest,
    scrollToElement,
  }
}
