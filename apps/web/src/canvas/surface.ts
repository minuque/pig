import {
  clampAxis,
  clampZoom,
  defaultCamera,
  fitCamera,
  panBy,
  zoomAt,
  type Bounds,
  type Camera,
  type Point,
} from "@/canvas/camera.js"
import { attachDrag } from "@/canvas/drag.js"
import {
  canScrollBox,
  focusAllowsSpacePan,
  wheelIntent,
  wheelZoomFactor,
  type ScrollBox,
} from "@/canvas/gesture.js"

const PAN_STEP = 48
const ZOOM_STEP = 1.12
const FIT_PADDING = 48

type SurfaceOptions = {
  viewport: HTMLElement
  world: HTMLElement
  camera: Camera
  onZoomLabel: (zoom: number) => void
  commitPosition: (id: string, point: Point) => void
  save: (camera: Camera) => void
}

function boxOf(el: HTMLElement): ScrollBox {
  const style = getComputedStyle(el)
  return {
    scrollTop: el.scrollTop,
    scrollLeft: el.scrollLeft,
    scrollHeight: el.scrollHeight,
    scrollWidth: el.scrollWidth,
    clientHeight: el.clientHeight,
    clientWidth: el.clientWidth,
    overflowX: style.overflowX,
    overflowY: style.overflowY,
  }
}

function nestedCanScroll(
  start: EventTarget | null,
  stop: HTMLElement,
  axis: "x" | "y",
  delta: number,
): boolean {
  let node = start instanceof Element ? start : null

  while (node && node !== stop) {
    if (node instanceof HTMLElement && canScrollBox(boxOf(node), axis, delta)) return true
    node = node.parentElement
  }

  return false
}

function measureItems(world: HTMLElement): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of world.querySelectorAll("[data-canvas-item]")) {
    if (!(node instanceof HTMLElement) || node.hasAttribute("data-canvas-placeholder")) continue

    if (node.offsetWidth === 0 && node.offsetHeight === 0) continue
    const x = Number.parseFloat(node.style.left) || 0
    const y = Number.parseFloat(node.style.top) || 0
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + node.offsetWidth)
    maxY = Math.max(maxY, y + node.offsetHeight)
  }

  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function lockPageScroll(): () => void {
  const root = document.documentElement
  const body = document.body
  const previous = {
    htmlOverflow: root.style.overflow,
    bodyOverflow: body.style.overflow,
    htmlOverscroll: root.style.overscrollBehaviorX,
    bodyOverscroll: body.style.overscrollBehaviorX,
  }

  root.style.overflow = "hidden"
  body.style.overflow = "hidden"
  root.style.overscrollBehaviorX = "none"
  body.style.overscrollBehaviorX = "none"
  return () => {
    root.style.overflow = previous.htmlOverflow
    body.style.overflow = previous.bodyOverflow
    root.style.overscrollBehaviorX = previous.htmlOverscroll
    body.style.overscrollBehaviorX = previous.bodyOverscroll
  }
}

export function mountSurface(options: SurfaceOptions) {
  const { viewport, world } = options
  let camera = options.camera
  let spaceHeld = false
  let suppressClick = false
  let frame = 0
  let zoomAnim = 0
  let suppressTimer = 0
  const unlockPage = lockPageScroll()

  function writeTransform() {
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
    options.onZoomLabel(camera.zoom)
  }

  function schedule() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      writeTransform()
    })
  }

  function apply(next: Camera) {
    camera = { x: clampAxis(next.x), y: clampAxis(next.y), zoom: clampZoom(next.zoom) }
    schedule()
  }

  function cancelZoomAnim() {
    if (!zoomAnim) return
    cancelAnimationFrame(zoomAnim)
    zoomAnim = 0
  }

  function localPoint(event: { clientX: number; clientY: number }): Point {
    const rect = viewport.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function center(): Point {
    return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }
  }

  function animateZoom(nextZoom: number, anchor: Point) {
    cancelZoomAnim()
    const from = camera
    const target = zoomAt(from, nextZoom, anchor)
    const started = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 160)
      const eased = 1 - (1 - t) ** 3
      camera = zoomAt(from, from.zoom * (target.zoom / from.zoom) ** eased, anchor)
      writeTransform()

      if (t < 1) zoomAnim = requestAnimationFrame(tick)
      else {
        zoomAnim = 0
        options.save(camera)
      }
    }

    zoomAnim = requestAnimationFrame(tick)
  }

  function markSuppressClick() {
    suppressClick = true
    window.clearTimeout(suppressTimer)
    suppressTimer = window.setTimeout(() => {
      suppressClick = false
    }, 400)
  }

  const drag = attachDrag({
    viewport,
    world,
    getCamera: () => camera,
    apply,
    cancelZoom: cancelZoomAnim,
    localPoint,
    save: () => options.save(camera),
    commitPosition: options.commitPosition,
    spaceHeld: () => spaceHeld,
    suppressClick: markSuppressClick,
  })

  function onWheel(event: WheelEvent) {
    const intent = wheelIntent({
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      canScrollX: nestedCanScroll(event.target, viewport, "x", event.deltaX),
      canScrollY: nestedCanScroll(event.target, viewport, "y", event.deltaY),
    })

    if (intent === "native") return
    event.preventDefault()
    cancelZoomAnim()

    if (intent === "zoom") {
      apply(
        zoomAt(
          camera,
          camera.zoom * wheelZoomFactor(event.deltaY, event.deltaMode),
          localPoint(event),
        ),
      )
    } else apply(panBy(camera, -event.deltaX, -event.deltaY))
    options.save(camera)
  }

  function onKeyDown(event: KeyboardEvent) {
    const active = document.activeElement
    const allowed =
      !(active instanceof Element) ||
      focusAllowsSpacePan(
        active.tagName,
        active.getAttribute("role"),
        active instanceof HTMLElement && active.isContentEditable,
      )

    if (event.code === "Space" && allowed && !event.repeat) {
      spaceHeld = true
      event.preventDefault()
    }

    const onShell =
      active === viewport ||
      (active instanceof Element && Boolean(active.closest("[data-canvas-controls]")))

    if (!onShell) return
    const step = event.shiftKey ? PAN_STEP * 4 : PAN_STEP
    const arrows: Record<string, Point> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    }
    const arrow = active === viewport ? arrows[event.key] : undefined

    if (arrow) apply(panBy(camera, arrow.x, arrow.y))
    else if (event.key === "+" || event.key === "=") animateZoom(camera.zoom * ZOOM_STEP, center())
    else if (event.key === "-" || event.key === "_") animateZoom(camera.zoom / ZOOM_STEP, center())
    else return
    event.preventDefault()
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code === "Space") spaceHeld = false
  }

  function clearHeld() {
    spaceHeld = false
    drag.clear()
  }

  function onClick(event: MouseEvent) {
    if (!suppressClick) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick = false
  }

  function reveal(id: string) {
    const item =
      world.querySelector(`[data-canvas-item="${CSS.escape(id)}"]`) ??
      [...world.querySelectorAll("[data-canvas-item]")].find(
        (node) => node.getAttribute("data-canvas-name") === id,
      )

    if (!(item instanceof HTMLElement)) return
    const x = Number.parseFloat(item.style.left) || 0
    const y = Number.parseFloat(item.style.top) || 0
    apply({
      x: viewport.clientWidth / 2 - (x + item.offsetWidth / 2) * camera.zoom,
      y: viewport.clientHeight / 2 - (y + item.offsetHeight / 2) * camera.zoom,
      zoom: camera.zoom,
    })
    options.save(camera)
  }

  function onAnchorClick(event: MouseEvent) {
    const anchor = event.target instanceof Element ? event.target.closest("a") : null

    if (!anchor || !viewport.contains(anchor)) return
    const href = anchor.getAttribute("href")
    event.preventDefault()

    if (href?.startsWith("#")) reveal(decodeURIComponent(href.slice(1)))
    else if (href) viewport.dispatchEvent(new CustomEvent("canvas-stay", { detail: href }))
  }

  function onFocusIn(event: FocusEvent) {
    const target = event.target

    if (!(target instanceof HTMLElement) || target === viewport || !viewport.contains(target))
      return
    const rect = target.getBoundingClientRect()
    const view = viewport.getBoundingClientRect()
    let dx = 0
    let dy = 0

    if (rect.left < view.left + 24) dx = view.left + 24 - rect.left

    if (rect.right > view.right - 24) dx = view.right - 24 - rect.right

    if (rect.top < view.top + 24) dy = view.top + 24 - rect.top

    if (rect.bottom > view.bottom - 24) dy = view.bottom - 24 - rect.bottom

    if (dx !== 0 || dy !== 0) apply(panBy(camera, dx, dy))
  }

  function onHide() {
    if (document.hidden) clearHeld()
  }

  viewport.addEventListener("wheel", onWheel, { passive: false })
  viewport.addEventListener("keydown", onKeyDown)
  viewport.addEventListener("keyup", onKeyUp)
  viewport.addEventListener("click", onClick, true)
  viewport.addEventListener("auxclick", onClick, true)
  viewport.addEventListener("click", onAnchorClick, true)
  viewport.addEventListener("focusin", onFocusIn)
  window.addEventListener("blur", clearHeld)
  document.addEventListener("visibilitychange", onHide)
  writeTransform()
  return {
    setCamera(next: Camera) {
      cancelZoomAnim()
      camera = next
      writeTransform()
    },
    getCamera: () => camera,
    zoomBy(factor: number) {
      animateZoom(camera.zoom * factor, center())
    },
    fit() {
      requestAnimationFrame(() => {
        const bounds = measureItems(world)

        if (!bounds) return
        cancelZoomAnim()
        camera = fitCamera(
          bounds,
          { width: viewport.clientWidth, height: viewport.clientHeight },
          FIT_PADDING,
        )
        writeTransform()
        options.save(camera)
      })
    },
    reset() {
      cancelZoomAnim()
      camera = defaultCamera()
      writeTransform()
      options.save(camera)
    },
    reveal,
    flush: () => options.save(camera),
    destroy() {
      cancelZoomAnim()

      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(suppressTimer)
      drag.destroy()
      options.save(camera)
      viewport.removeEventListener("wheel", onWheel)
      viewport.removeEventListener("keydown", onKeyDown)
      viewport.removeEventListener("keyup", onKeyUp)
      viewport.removeEventListener("click", onClick, true)
      viewport.removeEventListener("auxclick", onClick, true)
      viewport.removeEventListener("click", onAnchorClick, true)
      viewport.removeEventListener("focusin", onFocusIn)
      window.removeEventListener("blur", clearHeld)
      document.removeEventListener("visibilitychange", onHide)
      unlockPage()
    },
  }
}

export type CanvasSurface = ReturnType<typeof mountSurface>
