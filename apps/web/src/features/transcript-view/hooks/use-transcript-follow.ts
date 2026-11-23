import { onBeforeUnmount, onMounted, shallowRef } from "vue"
import { prefersReducedMotion } from "@utils/motion.js"
import {
  createGlideSpring,
  GLIDE_MAX_CATCHUP_FRAMES,
  GLIDE_MAX_VIEWPORTS,
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

function userScrollBehavior(): TranscriptScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth"
}

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
  let glideRaf = 0
  let lastScrollTop = 0
  let lastWritten = 0

  function inCooldown() {
    return performance.now() < cooldownUntil
  }

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
    if (glideRaf) cancelAnimationFrame(glideRaf)
    glideRaf = 0

    if (navTimer) {
      window.clearTimeout(navTimer)
      navTimer = 0
    }

    if (navRoot && onNavEnd) navRoot.removeEventListener("scrollend", onNavEnd)
    navRoot = null
    onNavEnd = null
    navigating = false
  }

  function detachFollow() {
    stopSettle()
    stopFlip()
    stopNavigate()
    cooldownUntil = 0
  }

  function settle(maxFrames = SETTLE_MAX_FRAMES) {
    const root = getRoot()

    if (!root || !atBottom.value || userTookOver || pointerDown || settleActive || navigating) {
      return
    }

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
    if (applying || !atBottom.value || pointerDown || userTookOver || navigating) return
    const root = getRoot()

    if (!root) return

    if (!settleRaf) scrollToBottomNow(root)
    settle()
  }

  function pinNow() {
    if (applying || !atBottom.value || pointerDown || userTookOver || navigating) return
    const root = getRoot()

    if (!root) return
    scrollToBottomNow(root)
  }

  function observeGrowth(el: HTMLElement) {
    const observer = new MutationObserver(pinNow)
    observer.observe(el, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style"],
    })
    return () => observer.disconnect()
  }

  function observePadding(el: HTMLElement) {
    let last = Number.parseFloat(getComputedStyle(el).paddingBottom)
    const observer = new ResizeObserver(() => {
      const pad = Number.parseFloat(getComputedStyle(el).paddingBottom)

      if (pad === last) return
      last = pad
      pinIfNeeded()
    })

    observer.observe(el, { box: "border-box" })
    return () => observer.disconnect()
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

  function glideToBottom() {
    stopNavigate()
    stopSettle()
    navigating = true
    const step = createGlideSpring()
    let last = performance.now()
    let pos = getRoot()?.scrollTop ?? 0
    const frame = (now: number) => {
      glideRaf = 0
      const root = getRoot()

      if (!root || !navigating) return
      const frames = Math.min(GLIDE_MAX_CATCHUP_FRAMES, ((now - last) * 60) / 1000)
      last = now
      const target = transcriptFloorTop(root.scrollHeight, root.clientHeight)
      pos = step(
        Math.max(pos, target - GLIDE_MAX_VIEWPORTS * root.clientHeight),
        target,
        Math.max(frames, 0.25),
      )
      writeScrollTop(root, pos)
      markProgrammatic()

      if (pos >= target) {
        finishNavigate()
        return
      }

      glideRaf = requestAnimationFrame(frame)
    }

    glideRaf = requestAnimationFrame(frame)
  }

  function onScroll() {
    if (applying) return
    const root = getRoot()

    if (!root) return
    const previous = lastScrollTop

    lastScrollTop = root.scrollTop
    updateVisual(root)

    if (navigating) return

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

    glideToBottom()
  }

  function scrollToElement(el: HTMLElement, block: ScrollLogicalPosition = "start") {
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

    el.scrollIntoView({ block, behavior: userScrollBehavior() })
  }

  function scrollToRange(range: Range) {
    detachFollow()
    atBottom.value = false
    visuallyAtBottom.value = false
    const root = getRoot()

    if (!root) return
    const rangeRect = range.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()

    if (rangeRect.height <= 0) {
      const container = range.startContainer
      const el = container instanceof HTMLElement ? container : container.parentElement

      if (el) scrollToElement(el, "center")
      return
    }

    navigating = true
    navRoot = root
    onNavEnd = () => finishNavigate()
    navRoot.addEventListener("scrollend", onNavEnd, { once: true })
    navTimer = window.setTimeout(finishNavigate, COOLDOWN_MS)
    const maxTop = Math.max(0, root.scrollHeight - root.clientHeight)
    const top = Math.min(
      maxTop,
      Math.max(
        0,
        root.scrollTop + rangeRect.top - rootRect.top - Math.min(140, root.clientHeight / 3),
      ),
    )

    root.scrollTo({ top, behavior: userScrollBehavior() })
  }

  function restoreScrollTop(top: number) {
    detachFollow()
    atBottom.value = false
    const root = getRoot()

    if (!root) return
    writeScrollTop(root, top)
    updateVisual(root)
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
    observeGrowth,
    observePadding,
    detachFollow,
    reset,
    onScroll,
    onWheel,
    onPointerDown,
    scrollToLatest,
    scrollToElement,
    scrollToRange,
    restoreScrollTop,
  }
}
