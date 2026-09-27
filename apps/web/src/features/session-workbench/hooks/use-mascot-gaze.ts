import { onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from "vue"
import { useEventListener, useMediaQuery } from "@vueuse/core"

type Point = { x: number; y: number }

/** 追视时间常数 ms：约 63% 行程所需时间。 */
const SETTLE = 110
/** 单帧目标位移超过该值（单位向量尺度）直接跳到位，不做平滑。 */
const SNAP = 1.6
/** 目标落在吉祥物半径的该比例内时视线回正，避免方向奇点乱抖。 */
const DEADZONE = 0.55
const EPS = 0.002
const MIRROR_STYLES = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "tabSize",
] as const
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** textarea 光标的视口坐标：镜像节点排版到光标处取标记位置。 */
function caretPoint(el: HTMLTextAreaElement): Point {
  const style = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  const mirror = document.createElement("div")

  for (const key of MIRROR_STYLES) mirror.style[key] = style[key]
  Object.assign(mirror.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  })
  mirror.textContent = el.value.slice(0, el.selectionEnd)
  const mark = mirror.appendChild(document.createElement("span"))
  mark.textContent = "\u200b"
  document.body.append(mirror)
  const box = mark.getBoundingClientRect()
  mirror.remove()
  return { x: box.left - el.scrollLeft, y: box.top + box.height / 2 - el.scrollTop }
}

/** 眼睛追视指针或输入光标，写 --gaze-x/--gaze-y；随机眨眼。 */
export function useMascotGaze(el: Readonly<Ref<SVGSVGElement | null>>) {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)")
  const blinking = shallowRef(false)
  let pointer: Point | null = null
  let target: Point | null = null
  let x = 0
  let y = 0
  let last = 0
  let raf = 0
  let blinkTimer = 0

  function write(svg: SVGSVGElement) {
    svg.style.setProperty("--gaze-x", x.toFixed(3))
    svg.style.setProperty("--gaze-y", y.toFixed(3))
  }

  function frame(t: number) {
    raf = 0
    const svg = el.value

    if (!svg) return
    const dt = last ? Math.min(t - last, 64) : 16
    last = t
    const r = svg.getBoundingClientRect()
    let tx = 0
    let ty = 0

    if (target) {
      const dx = target.x - (r.left + r.width / 2)
      const dy = target.y - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy)
      const near = smoothstep(Math.min(1, d / ((Math.min(r.width, r.height) / 2) * DEADZONE)))

      if (d > 0) {
        tx = (dx / d) * near
        ty = (dy / d) * near
      }
    }

    const f = Math.hypot(tx - x, ty - y) > SNAP ? 1 : 1 - Math.exp(-dt / SETTLE)
    x += (tx - x) * f
    y += (ty - y) * f
    const settled = Math.abs(tx - x) <= EPS && Math.abs(ty - y) <= EPS

    if (settled) {
      x = tx
      y = ty
      last = 0
    } else raf = requestAnimationFrame(frame)
    write(svg)
  }

  function lookAt(next: Point | null) {
    if (still.value) return
    target = next

    if (!raf) raf = requestAnimationFrame(frame)
  }

  function followCaret() {
    const active = document.activeElement

    if (active instanceof HTMLTextAreaElement) lookAt(caretPoint(active))
  }

  function scheduleBlink(delay = 2500 + Math.random() * 3500) {
    clearTimeout(blinkTimer)

    if (still.value) return
    blinkTimer = window.setTimeout(() => (blinking.value = true), delay)
  }

  /** 眨完排下一次；两成概率紧跟一次双眨。 */
  function onBlinkEnd() {
    blinking.value = false
    scheduleBlink(Math.random() < 0.2 ? 120 : undefined)
  }

  useEventListener(window, "pointermove", (event: PointerEvent) => {
    pointer = { x: event.clientX, y: event.clientY }
    lookAt(pointer)
  })
  useEventListener(document.documentElement, "mouseleave", () => {
    pointer = null
    lookAt(null)
  })
  useEventListener(document, "selectionchange", followCaret)
  useEventListener(document, "input", followCaret, { capture: true })
  useEventListener(document, "focusout", (event: FocusEvent) => {
    if (event.target instanceof HTMLTextAreaElement) lookAt(pointer)
  })

  watch(still, (reduce) => {
    if (!reduce) return scheduleBlink()
    target = null
    x = y = 0
    blinking.value = false
    clearTimeout(blinkTimer)

    if (el.value) write(el.value)
  })

  onMounted(() => scheduleBlink())
  onBeforeUnmount(() => {
    cancelAnimationFrame(raf)
    clearTimeout(blinkTimer)
  })
  return { blinking, onBlinkEnd }
}
