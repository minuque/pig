/** 强度滑条外壳的几何：参考实现整体缩到 2/3，轨道约 21px 胶囊，拖动时顶部长出凸台。轨道宽度由调用方实测传入。 */

const SCALE = 2 / 3
export const HEIGHT = 32 * SCALE
export const RADIUS = HEIGHT / 2
export const BUMP_H = 20 * SCALE
export const REST_W = 27.2 * SCALE
export const DRAG_W = 33.6 * SCALE
export const REST_H = 27.2 * SCALE
export const EDGE_PAD = (HEIGHT - REST_H) / 2
/** 肩部曲线的设计稿宽度：控制点按它归一化，实际宽度再按比例放回。 */
const SHOULDER_DESIGN = 23.572
const LEFT_SHOULDER = SHOULDER_DESIGN * SCALE
const TEXT_SIDE = 20 * SCALE
const PHI_MAX = 0.6
const PHI_REACH = 36 * SCALE

export interface ShellGeom {
  topL: number
  topR: number
  phiL: number
  phiR: number
  insetL: number
  insetR: number
}

interface Point {
  x: number
  y: number
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}

/** 第 value 档滑块中心的横坐标；steps 是档位数减一。 */
export function centerFor(value: number, steps: number, track: number): number {
  return RADIUS + (steps === 0 ? 0 : value / steps) * (track - RADIUS * 2)
}

/** 刻度由低到高逐级加高：4 档时是设计稿 4.8 / 6.4 / 8 / 9.6 的 2/3。 */
export function tickHeight(index: number, steps: number): number {
  return (4.8 + (steps === 0 ? 0 : index / steps) * 4.8) * SCALE
}

export function plateauFor(width: number): number {
  return Math.max(8, width + TEXT_SIDE * 2 - LEFT_SHOULDER * 2)
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function capFoot(side: -1 | 1, phi: number, track: number): Point {
  const crown = side === -1 ? RADIUS : track - RADIUS
  return {
    x: crown + side * RADIUS * Math.sin(phi),
    y: BUMP_H + RADIUS * (1 - Math.cos(phi)),
  }
}

/** 凸台平顶的左右端：贴近两端时顺着圆角下滑，平顶整体被推回轨道内。 */
export function shellGeom(cx: number, plateau: number, track: number): ShellGeom {
  const crownL = RADIUS
  const crownR = track - RADIUS
  let topL = cx - plateau / 2
  let topR = topL + plateau
  let phiL = 0
  let phiR = 0
  const overflowL = crownL - (topL - LEFT_SHOULDER)

  if (overflowL > 0) {
    phiL = PHI_MAX * smoothstep(overflowL / PHI_REACH)
    const foot = capFoot(-1, phiL, track)
    const minTopL = foot.x + LEFT_SHOULDER * Math.cos(phiL)

    if (topL < minTopL) {
      topR += minTopL - topL
      topL = minTopL
    }
  }

  const overflowR = topR + LEFT_SHOULDER - crownR

  if (overflowR > 0) {
    phiR = PHI_MAX * smoothstep(overflowR / PHI_REACH)
    const foot = capFoot(1, phiR, track)
    const maxTopR = foot.x - LEFT_SHOULDER * Math.cos(phiR)

    if (topR > maxTopR) {
      topL -= topR - maxTopR
      topR = maxTopR
    }
  }

  const insetL = phiL > 0 ? LEFT_SHOULDER * (1 - Math.cos(phiL)) : 0
  const insetR = phiR > 0 ? LEFT_SHOULDER * (1 - Math.cos(phiR)) : 0
  topR += insetL
  topL -= insetR
  return { topL, topR, phiL, phiR, insetL, insetR }
}

function shoulderCmds(
  footX: number,
  footY: number,
  platX: number,
  platY: number,
  phi: number,
  dir: -1 | 1,
): string {
  const xScale = Math.abs(platX - footX) / SHOULDER_DESIGN
  const yScale = Math.max(0.001, (footY - platY) / 20)
  const tangent = { x: dir * Math.cos(phi), y: -Math.sin(phi) }
  const map = (lx: number, ly: number): Point => ({
    x: footX + dir * lx * xScale,
    y: footY + (ly - 20) * yScale,
  })
  const h1 = 5.398 * xScale
  const p0 = { x: footX, y: footY }
  const c1 = { x: footX + tangent.x * h1, y: footY + tangent.y * h1 }
  const c2 = map(10.012, 16.114)
  const p1 = map(10.93, 10.794)
  const c3 = map(11.916, 4.577)
  const c4 = map(17.277, 0)
  const p3 = { x: platX, y: platY }
  const fmt = (p: Point) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`

  if (dir === 1) return `C${fmt(c1)} ${fmt(c2)} ${fmt(p1)}C${fmt(c3)} ${fmt(c4)} ${fmt(p3)}`
  return `C${fmt(c4)} ${fmt(c3)} ${fmt(p1)}C${fmt(c2)} ${fmt(c1)} ${fmt(p0)}`
}

/** 外壳 SVG 路径：openAmount 为 0 时是纯胶囊，为 1 时凸台完全长出。 */
export function shellPath(cx: number, openAmount: number, plateau: number, track: number): string {
  const trackTop = BUMP_H
  const trackBot = BUMP_H + HEIGHT
  const crownL = RADIUS
  const crownR = track - RADIUS

  if (openAmount < 0.012) {
    return `M${crownL} ${trackTop}H${crownR}A${RADIUS} ${RADIUS} 0 0 1 ${crownR} ${trackBot}H${crownL}A${RADIUS} ${RADIUS} 0 0 1 ${crownL} ${trackTop}Z`
  }

  const bumpTop = BUMP_H * (1 - openAmount)
  const { topL, topR, phiL, phiR } = shellGeom(cx, plateau, track)
  const cmds = [`M${crownL} ${trackBot}`]

  if (phiL > 0.001) {
    const foot = capFoot(-1, phiL, track)
    cmds.push(`A${RADIUS} ${RADIUS} 0 0 1 ${foot.x.toFixed(2)} ${foot.y.toFixed(2)}`)
    cmds.push(shoulderCmds(foot.x, foot.y, topL, bumpTop, phiL, 1))
  } else {
    cmds.push(`A${RADIUS} ${RADIUS} 0 0 1 ${crownL} ${trackTop}`)
    const footL = topL - LEFT_SHOULDER

    if (footL > crownL + 0.4) cmds.push(`H${footL.toFixed(2)}`)
    cmds.push(shoulderCmds(footL, trackTop, topL, bumpTop, 0, 1))
  }

  if (topR > topL + 0.4) cmds.push(`H${topR.toFixed(2)}`)

  if (phiR > 0.001) {
    const foot = capFoot(1, phiR, track)
    cmds.push(shoulderCmds(foot.x, foot.y, topR, bumpTop, phiR, -1))
    cmds.push(`A${RADIUS} ${RADIUS} 0 0 1 ${crownR} ${trackBot}`)
  } else {
    const footR = topR + LEFT_SHOULDER
    cmds.push(shoulderCmds(footR, trackTop, topR, bumpTop, 0, -1))

    if (footR < crownR - 0.4) cmds.push(`H${crownR}`)
    cmds.push(`A${RADIUS} ${RADIUS} 0 0 1 ${crownR} ${trackBot}`)
  }

  cmds.push(`H${crownL}Z`)
  return cmds.join("")
}

/** 从起点到终点按 ease-out 补间，每帧回调；返回取消函数。reduce 时直接落到终点。 */
export function tween(
  from: number,
  to: number,
  duration: number,
  onFrame: (value: number, done: boolean) => void,
  delay = 0,
): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onFrame(to, true)
    return () => {}
  }

  const start = performance.now()
  let raf = 0
  const step = (now: number) => {
    const elapsed = now - start - delay

    if (elapsed < 0) {
      raf = requestAnimationFrame(step)
      return
    }

    const t = Math.min(1, elapsed / duration)
    onFrame(from + (to - from) * easeOut(t), t === 1)

    if (t < 1) raf = requestAnimationFrame(step)
  }

  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}
