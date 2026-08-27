import type { SessionPhase } from "@earendil-works/pi-protocol"

/** 非 idle 视为运行中。 */
export function isRunning(phase: SessionPhase | undefined): boolean {
  return phase !== undefined && phase !== "idle"
}

/** phase 文案：对齐官方 SessionPhase。 */
export function phaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case "turn":
      return "运行中"
    case "compaction":
      return "压缩中"
    case "retry":
      return "重试中"
    case "branch_summary":
      return "分支摘要"
    default:
      return "空闲"
  }
}
