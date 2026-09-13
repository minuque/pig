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

/** 内容增高时按帧跟随；用户上翻立即停，首次打开和减少动态效果直接贴底。 */
export function useTranscriptFollow(getRoot: () => HTMLElement | null) {
  const atBottom = shallowRef(false)
  const visuallyAtBottom = shallowRef(false)
  let navigating = false
  let navRoot: HTMLElement | null = null
  let onNavEnd: (() => void) | null = null
  let navTimer = 0
  let lastWritten = 0
  let followRaf = 0
  let lastFrame = 0
  let position = 0
  let velocity = 0
  let applying = false

  function stopFollow() {
    if (followRaf) cancelAnimationFrame(followRaf)
    followRaf = 0
    lastFrame = 0
    velocity = 0
  }

  function writeScrollTop(root: HTMLElement, top: number) {
    applying = true
    root.scrollTop = top
    applying = false
  }

  function followFrame(now: number) {
    const root = getRoot()
    if (!root || navigating || !atBottom.value) {
      stopFollow()
      return
    }
    const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)
    if (root.scrollTop + 2 < Math.min(lastWritten, floor)) {
      atBottom.value = false
      applyBottom(root)
      stopFollow()
      return
    }
    if (prefersReducedMotion() || floor - position <= 0.5) {
      stopFollow()
      jumpToBottom()
      return
    }
    const dt = Math.min(Math.max(0, now - lastFrame), 32) / 1000
    lastFrame = now
    // 临界阻尼弹簧的解析解，保留小数位置以免滚动像素取整阻止收敛。
    const offset = position - floor
    const impulse = velocity + 24 * offset
    const decay = Math.exp(-24 * dt)
    const next = floor + (offset + impulse * dt) * decay
    velocity = (velocity - 24 * impulse * dt) * decay
    position = Math.min(floor, Math.max(root.scrollTop, next))
    writeScrollTop(root, position)
    lastWritten = root.scrollTop
    visuallyAtBottom.value = isTranscriptVisuallyAtBottom(
      root.scrollHeight,
      lastWritten,
      root.clientHeight,
    )
    followRaf = requestAnimationFrame(followFrame)
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
    const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)
    lastWritten = floor
    if (Math.abs(root.scrollTop - floor) > 0.5) writeScrollTop(root, floor)
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
    const root = getRoot()
    if (!root) return
    if (prefersReducedMotion()) {
      stopFollow()
      jumpToBottom()
      return
    }
    if (followRaf) return
    const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)
    if (floor - root.scrollTop <= 0.5) {
      jumpToBottom()
      return
    }
    position = root.scrollTop
    lastWritten = root.scrollTop
    lastFrame = performance.now()
    followRaf = requestAnimationFrame(followFrame)
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
      const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)
      if (root.scrollTop + 2 < Math.min(lastWritten, floor)) {
        stopFollow()
        atBottom.value = false
        visuallyAtBottom.value = isTranscriptVisuallyAtBottom(
          root.scrollHeight,
          root.scrollTop,
          root.clientHeight,
        )
        return
      }
      visuallyAtBottom.value = isTranscriptVisuallyAtBottom(
        root.scrollHeight,
        root.scrollTop,
        root.clientHeight,
      )
      pinIfNeeded()
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
