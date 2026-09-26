/** compact↔expanded 折叠决策：换行一律展开；容量是布局稳定量，绝不用折叠后的测量值回灌。 */

/** 低于此宽度永远展开，单行挤不下动作行。 */
export const MIN_COMPACT_CAPACITY = 200
/** 展开↔折叠的滞回间隙，避免在阈值附近抖动。 */
export const COLLAPSE_HYSTERESIS = 32
/** 拖窗口/拖宽度手柄期间折叠延后，展开仍然立即。 */
export const RESIZE_SETTLE_MS = 150

export interface ComposerFlipInput {
  /** 新会话首屏：输入卡恒展开。 */
  hero?: boolean
  /** 正文含换行：多行内容没有紧凑态。 */
  hasNewline: boolean
  /** 单行文本的测量宽度（px）。 */
  textWidth: number
  /** 紧凑态下输入区可用的稳定宽度（px）。 */
  capacity: number
  expanded: boolean
  /** 尺寸变化未落定：此期间不折叠。 */
  resizing: boolean
}

export function composerFlip(input: ComposerFlipInput): boolean {
  if (input.hero || input.hasNewline) return true

  if (input.capacity < MIN_COMPACT_CAPACITY) return true

  if (!input.expanded) return input.textWidth > input.capacity

  if (input.resizing) return true
  return input.textWidth >= input.capacity - COLLAPSE_HYSTERESIS
}

export interface FlipMotion {
  duration: number
  easing: string
}

type Offset = { x: number; y: number }

/** 相对卡片左下角的位置：外层输入条停靠滑动时不串进动作组位移。 */
export function clusterOffsets(card: HTMLElement, els: readonly HTMLElement[]): Offset[] {
  const box = card.getBoundingClientRect()
  return els.map((el) => {
    const rect = el.getBoundingClientRect()
    return { x: rect.left - box.left, y: rect.bottom - box.bottom }
  })
}

/** 动作组从旧槽位滑到新槽位；dimmed 横跨整行时中段压暗，避免长标签扫过正文。 */
export function glideClusters(
  card: HTMLElement,
  els: readonly HTMLElement[],
  from: readonly Offset[],
  motion: FlipMotion,
  dimmed?: HTMLElement | null,
): void {
  els.forEach((el) => el.getAnimations().forEach((animation) => animation.cancel()))
  const to = clusterOffsets(card, els)

  els.forEach((el, index) => {
    const start = from[index]
    const end = to[index]

    if (!start || !end) return
    const dx = start.x - end.x
    const dy = start.y - end.y

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
    const dim = el === dimmed && Math.abs(dx) > 24

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        ...(dim ? [{ opacity: 0.35, offset: 0.45 }] : []),
        { transform: "none" },
      ],
      { duration: motion.duration, easing: motion.easing },
    )
  })
}

/** 从 motion token 读时长与曲线；不传 dock 是输入卡展开形变，in/out 是停靠与回到首屏。 */
export function flipMotion(el: Element, dock?: "in" | "out"): FlipMotion {
  const style = getComputedStyle(el)
  const duration = dock ? `--duration-dock-${dock}` : "--duration-composer-flip"
  const easing = dock ? "--ease-dock" : "--ease-composer-flip"
  return {
    duration: Number.parseFloat(style.getPropertyValue(duration)) || 0,
    easing: style.getPropertyValue(easing).trim() || "ease-out",
  }
}
