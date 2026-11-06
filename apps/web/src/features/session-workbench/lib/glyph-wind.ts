/** 欢迎页字符风场的纯计算：噪声、风场强度、内容区让位。不碰 DOM。 */

const TAU = Math.PI * 2

function hash(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 三维值噪声，输出约在 -1 到 1。 */
export function noise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)
  const corner = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz, seed)
  const near = lerp(
    lerp(corner(0, 0, 0), corner(1, 0, 0), u),
    lerp(corner(0, 1, 0), corner(1, 1, 0), u),
    v,
  )
  const far = lerp(
    lerp(corner(0, 0, 1), corner(1, 0, 1), u),
    lerp(corner(0, 1, 1), corner(1, 1, 1), u),
    v,
  )
  return lerp(near, far, w) * 2 - 1
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export interface WindFrame {
  /** 风向（弧度），缓慢摆动。 */
  heading: number
  /** 风已吹过的距离（px）。 */
  carried: number
  time: number
  seed: number
}

/** 当前时刻的风：方向在一个小角度内慢慢摆，速度带一点阵风起伏。 */
export function windAt(time: number, seed: number): WindFrame {
  const heading = -0.35 + 0.5 * noise3(time * 0.02, 1.3, 0, seed)
  const carried = 34 * time + 60 * noise3(time * 0.09, 3.7, 0, seed)
  return { heading, carried, time, seed }
}

const GUST_W = 420
const GUST_H = 150
/** 低于这条线的风不显形：大半个画面平时是空的。 */
const LEVEL = 0.32
const BAND = 0.16

/** 一个点上的风强 0..1：沿风向拉长的几层阵风，叠上细丝，再过阈值。 */
export function windStrength(x: number, y: number, wind: WindFrame): number {
  const cos = Math.cos(wind.heading)
  const sin = Math.sin(wind.heading)
  const along = x * cos + y * sin
  const across = -x * sin + y * cos
  const t = wind.time
  let gust = 0
  let weight = 1
  let power = 0
  let sx = GUST_W
  let sy = GUST_H

  for (let k = 0; k < 3; k++) {
    gust +=
      weight *
      noise3(
        (along - wind.carried * (1 + 0.1 * k)) / sx,
        across / sy,
        t * (0.05 + 0.03 * k) + 11 * k,
        wind.seed + k,
      )
    power += weight * weight
    weight *= 0.5
    sx *= 0.5
    sy *= 0.58
  }

  const swell = Math.cos(((along - wind.carried) / 900) * TAU)
  const field = gust / Math.sqrt(power) + 0.18 * swell
  const lit = smoothstep(LEVEL - BAND, LEVEL + BAND, field)

  if (lit <= 0) return 0
  // 阵风里再分出细而快的条纹，像风吹过水面
  const thread = noise3((along - wind.carried * 1.6) / 140, across / 30, t * 0.16, wind.seed + 7)
  const streaks = 1 - smoothstep(0, 0.5, Math.abs(thread))
  return lit * lit * (0.4 + 0.6 * streaks)
}

/** 内容区让位：标题与输入条一带的风变薄，四周不受影响。 */
export function calmAt(x: number, y: number, width: number, height: number): number {
  const ex = (x - width / 2) / 300
  const ey = (y - height * 0.45) / 120
  return 1 - 0.75 * Math.exp(-0.9 * (ex * ex + ey * ey))
}
