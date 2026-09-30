// 轨迹连线生长：干在 x=6.5，bend 半径 6px，枝到图标左沿 15.5px。
export const RAIL_TRUNK_X = 6.5
export const RAIL_BRANCH_LEN = 15.5
export const RAIL_BRANCH_R = 6
export const RAIL_BRANCH_LENGTH = RAIL_BRANCH_R * (Math.PI / 2) + (RAIL_BRANCH_LEN - RAIL_BRANCH_R)
// 新步骤逐个错开一拍
export const STEP_STAGGER_MS = 65
// 480ms ease-out-quint
export const STEP_REVEAL_MS = 480

export type RailPath = Record<string, string | number>

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

// 主干先到 bend，枝尖略覆盖主干末段，弯前不留死帧
export function connectorParts(progress: number, hasPredecessor: boolean) {
  const [inEnd, brStart] = hasPredecessor ? [0.72, 0.68] : [0.62, 0.58]
  return {
    incoming: clamp01(progress / inEnd),
    branch: clamp01((progress - brStart) / (1 - brStart)),
  }
}

// start 缺省表示历史步骤，直接到位
export function arrivalProgress(start: number | undefined, at: number) {
  if (start === undefined) return 1
  return 1 - (1 - clamp01((at - start) / STEP_REVEAL_MS)) ** 5
}

function branchD(y: number) {
  return `M ${RAIL_TRUNK_X} ${y - RAIL_BRANCH_R} Q ${RAIL_TRUNK_X} ${y} ${RAIL_TRUNK_X + RAIL_BRANCH_R} ${y} H ${RAIL_TRUNK_X + RAIL_BRANCH_LEN}`
}

// centers 是每行 summary 中心的 y。干从上一行 bend 接到本行 bend，末行止于 bend。
// 干与已长成的枝合成一条 path：同一 path 的 stroke 只画一遍，弯角处半透明不叠色；
// 正在长出的枝单独一条，走 dash 与 opacity。
export function buildRailPaths(input: {
  centers: readonly number[]
  progress: readonly number[]
}): RailPath[] {
  const { centers, progress } = input
  const growing: RailPath[] = []
  let settled = ""
  let top = 0

  for (const [index, y] of centers.entries()) {
    const bendY = y - RAIL_BRANCH_R
    const { incoming, branch } = connectorParts(progress[index] ?? 1, index > 0)
    const reach = top + (bendY - top) * incoming

    if (reach > top) settled += `M ${RAIL_TRUNK_X} ${top} V ${reach} `

    if (branch >= 1) settled += `${branchD(y)} `
    else if (branch > 0) {
      growing.push({
        d: branchD(y),
        pathLength: RAIL_BRANCH_LENGTH,
        "stroke-dasharray": RAIL_BRANCH_LENGTH,
        "stroke-dashoffset": RAIL_BRANCH_LENGTH * (1 - branch),
        opacity: branch,
      })
    }

    top = bendY
  }

  return settled ? [{ d: settled.trimEnd() }, ...growing] : growing
}
