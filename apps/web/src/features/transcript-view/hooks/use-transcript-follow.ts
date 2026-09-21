import { onBeforeUnmount, onMounted, shallowRef } from "vue"
import {
  isTranscriptVisuallyAtBottom,
  resolveFollowTarget,
  transcriptFloorTop,
} from "@features/transcript-view/lib/transcript-scroll.js"

export type TranscriptScrollBehavior = "auto" | "smooth"

const COOLDOWN_MS = 1000
const SETTLE_MAX_FRAMES = 36
const SETTLE_STABLE_FRAMES = 3
const FLIP_FRAMES = 2
const SCROLLBAR_HOT_PX = 12

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function userScrollBehavior(): TranscriptScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth"
}

/**
 * 内容增高时每帧贴底到布局稳定；用户上翻立即停，程序化滚动有冷却。
 * 脱底/吸附带滞回，状态翻转等两个 rAF 确认。
 */
export function useTranscriptFollow(getRoot: () => HTMLElement | null) {
  const atBottom = shallowRef(false)
  const visuallyAtBottom = shallowRef(false)
  let applying = false
  let generation = 0
  let settleActive = false
  let settleRaf = 0
  let settleFrames = 0
  let stableFrames = 0
  let signature = ""
  let flipRaf = 0
  let flipFrames = 0
  let pendingFlip: boolean | null = null
  let cooldownUntil = 0
  let pointerDown = false
  let userTookOver = false
  let navigating = false
  let navRoot: HTMLElement | null = null
  let onNavEnd: (() => void) | null = null
  let navTimer = 0
  let lastScrollTop = 0
  let lastWritten = 0

  function inCooldown() {
    return performance.now() < cooldownUntil
  }

  /** 视口被拖到上次写入位置上方：内容收缩的浏览器钳位不算。 */
  function userScrolledUp(root: HTMLElement) {
    const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)
    return root.scrollTop + 2 < Math.min(lastWritten, floor)
  }

  function markProgrammatic() {
    cooldownUntil = performance.now() + COOLDOWN_MS
  }

  function updateVisual(root: HTMLElement) {
    visuallyAtBottom.value = isTranscriptVisuallyAtBottom(
      root.scrollHeight,
      root.scrollTop,
      root.clientHeight,
    )
  }

  function writeScrollTop(root: HTMLElement, top: number) {
    applying = true
    root.scrollTop = top
    applying = false
    lastScrollTop = root.scrollTop
    lastWritten = root.scrollTop
  }

  function scrollToBottomNow(root: HTMLElement) {
    const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)

    if (Math.abs(root.scrollTop - floor) > 0.5) {
      writeScrollTop(root, floor)
    } else {
      lastScrollTop = root.scrollTop
      lastWritten = root.scrollTop
    }

    markProgrammatic()
    visuallyAtBottom.value = true
  }

  function clearSettle() {
    if (settleRaf) cancelAnimationFrame(settleRaf)
    settleRaf = 0
    settleFrames = 0
    stableFrames = 0
    signature = ""
  }

  function stopSettle() {
    settleActive = false
    clearSettle()
  }

  function stopFlip() {
    if (flipRaf) cancelAnimationFrame(flipRaf)
    flipRaf = 0
    flipFrames = 0
    pendingFlip = null
  }

  function stopNavigate() {
    if (navTimer) {
      window.clearTimeout(navTimer)
      navTimer = 0
    }

    if (navRoot && onNavEnd) navRoot.removeEventListener("scrollend", onNavEnd)
    navRoot = null
    onNavEnd = null
    navigating = false
  }

  /** 用户接管：停自动滚动、停翻转、清冷却。 */
  function detachFollow() {
    stopSettle()
    stopFlip()
    stopNavigate()
    cooldownUntil = 0
  }

  /** 有界收敛：每帧贴底，布局签名连续不变或到帧数上限就停。 */
  function settle(maxFrames = SETTLE_MAX_FRAMES) {
    const root = getRoot()

    if (!root || !atBottom.value || userTookOver || pointerDown || settleActive) return
    const mine = ++generation

    settleActive = true
    clearSettle()
    settleRaf = requestAnimationFrame(step)

    function step() {
      settleRaf = 0

      if (mine !== generation) {
        settleActive = false
        return
      }

      const node = getRoot()

      if (!node || !atBottom.value || userTookOver || pointerDown) {
        settleActive = false
        return
      }

      scrollToBottomNow(node)
      const next = `${node.scrollHeight}:${node.clientHeight}`

      stableFrames = next === signature ? stableFrames + 1 : 0
      signature = next
      settleFrames += 1

      if (settleFrames >= maxFrames || stableFrames >= SETTLE_STABLE_FRAMES) {
        settleActive = false
        return
      }

      settleRaf = requestAnimationFrame(step)
    }
  }

  function commitFlip(value: boolean) {
    if (atBottom.value === value) return
    atBottom.value = value
    const root = getRoot()

    if (!root) return

    if (!value) {
      stopSettle()
      updateVisual(root)
      return
    }

    scrollToBottomNow(root)
    settle()
  }

  function confirmFlip() {
    flipRaf = 0
    const value = pendingFlip

    if (value === null) return
    flipFrames += 1

    if (flipFrames < FLIP_FRAMES) {
      flipRaf = requestAnimationFrame(confirmFlip)
      return
    }

    pendingFlip = null
    commitFlip(value)
  }

  function requestFlip(value: boolean) {
    if (value === atBottom.value) {
      stopFlip()
      return
    }

    if (pendingFlip === value) return
    pendingFlip = value
    flipFrames = 0

    if (flipRaf) cancelAnimationFrame(flipRaf)
    flipRaf = requestAnimationFrame(confirmFlip)
  }

  function pinIfNeeded() {
    if (applying || !atBottom.value || pointerDown || userTookOver) return
    const root = getRoot()

    if (!root) return

    if (!settleRaf) scrollToBottomNow(root)
    settle()
  }

  function finishNavigate() {
    if (!navigating) return
    stopNavigate()

    if (!atBottom.value) return
    const root = getRoot()

    if (!root) return
    scrollToBottomNow(root)
    settle()
  }

  function beginNavigate(root: HTMLElement, top: number) {
    stopNavigate()
    navigating = true
    navRoot = root
    markProgrammatic()
    onNavEnd = () => finishNavigate()
    root.addEventListener("scrollend", onNavEnd, { once: true })
    navTimer = window.setTimeout(finishNavigate, COOLDOWN_MS) // ponytail: 无 scrollend 时收尾
    root.scrollTo({ top, behavior: "smooth" })
  }

  function onScroll() {
    if (applying) return
    const root = getRoot()

    if (!root) return
    const previous = lastScrollTop

    lastScrollTop = root.scrollTop
    updateVisual(root)

    if (navigating) return

    // 越过上次程序化写入的位置就是用户接管，冷却也不拦
    if (cooldownUntil !== 0 && userScrolledUp(root)) detachFollow()

    if (pointerDown || userTookOver) return

    if (inCooldown()) {
      if (atBottom.value) pinIfNeeded()
      return
    }

    const target = resolveFollowTarget({
      atBottom: atBottom.value,
      distanceFromBottom: root.scrollHeight - root.scrollTop - root.clientHeight,
      viewportHeight: root.clientHeight,
      scrollingDown: root.scrollTop > previous,
    })

    requestFlip(target)
  }

  function onWheel(event: WheelEvent) {
    if (event.deltaY < 0) {
      detachFollow()
      atBottom.value = false
    }

    const root = getRoot()

    if (!root) return
    const onScroller = event.target instanceof Node && root.contains(event.target)

    if (onScroller || event.deltaY === 0) return
    event.preventDefault()
    root.scrollTop += event.deltaY
  }

  /** 按在滚动条热区立刻脱底，按下期间不重新吸附。 */
  function onPointerDown(event: PointerEvent) {
    pointerDown = true
    userTookOver = true
    detachFollow()
    const root = getRoot()

    if (!root) return
    const rect = root.getBoundingClientRect()
    const hot = Math.max(root.offsetWidth - root.clientWidth, SCROLLBAR_HOT_PX)

    if (event.clientX < rect.right - hot) return
    atBottom.value = false
    updateVisual(root)
  }

  function onPointerUp() {
    pointerDown = false
    userTookOver = false
  }

  function releasePinnedToBottom() {
    detachFollow()
  }

  function reset() {
    detachFollow()
    pointerDown = false
    userTookOver = false
    atBottom.value = false
    visuallyAtBottom.value = false
  }

  function scrollToLatest(behavior: TranscriptScrollBehavior = "auto") {
    atBottom.value = true
    visuallyAtBottom.value = true
    const root = getRoot()

    if (!root) return
    const floor = transcriptFloorTop(root.scrollHeight, root.clientHeight)
    const instant = behavior === "auto" || prefersReducedMotion()

    if (instant || Math.abs(root.scrollTop - floor) <= 2) {
      stopNavigate()
      scrollToBottomNow(root)
      settle()
      return
    }

    beginNavigate(root, floor)
  }

  function scrollToElement(el: HTMLElement) {
    detachFollow()
    atBottom.value = false
    visuallyAtBottom.value = false
    const root = getRoot()

    if (root) {
      navigating = true
      navRoot = root
      onNavEnd = () => finishNavigate()
      navRoot.addEventListener("scrollend", onNavEnd, { once: true })
      navTimer = window.setTimeout(finishNavigate, COOLDOWN_MS)
    }

    el.scrollIntoView({ block: "start", behavior: userScrollBehavior() })
  }

  onMounted(() => {
    window.addEventListener("pointerup", onPointerUp, { passive: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener("pointerup", onPointerUp)
    detachFollow()
  })
  return {
    atBottom,
    visuallyAtBottom,
    pinIfNeeded,
    releasePinnedToBottom,
    reset,
    onScroll,
    onWheel,
    onPointerDown,
    scrollToLatest,
    scrollToElement,
  }
}
