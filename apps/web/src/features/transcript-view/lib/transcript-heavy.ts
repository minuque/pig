import type { TimelineRow } from "@features/transcript-view/type.js"

/** 每帧最多升级几行走重渲染，避免停稳瞬间一次性补齐造成长任务。 */
export const HEAVY_UPGRADE_PER_FRAME = 1

export type HeavyCandidate = { id: string; role: TimelineRow["role"]; streaming?: boolean }

export type HeavyGateState = {
  heavy: ReadonlySet<string>
  immediate: ReadonlySet<string>
  idle: boolean
}

/** 助手行才分轻重；流式中的行由调用方直接放行，不占每帧额度。 */
export function canUpgradeHeavy(row: HeavyCandidate): boolean {
  return row.role === "assistant" && !row.streaming
}

/** 还在流的行必须一直重渲染，否则流一结束就退回纯文本。 */
export function streamingIds(rows: readonly HeavyCandidate[]): string[] {
  return rows.filter((row) => row.role === "assistant" && row.streaming).map((row) => row.id)
}

/** 这一帧升级哪些行：按窗口顺序取上限个，滚动中只放行点名过的行。 */
export function pickHeavyUpgrades(
  rows: readonly HeavyCandidate[],
  state: HeavyGateState,
  limit = HEAVY_UPGRADE_PER_FRAME,
): string[] {
  if (limit <= 0) return []
  const picked: string[] = []

  for (const row of rows) {
    if (picked.length >= limit) break

    if (!canUpgradeHeavy(row)) continue

    if (state.heavy.has(row.id)) continue

    if (!state.idle && !state.immediate.has(row.id)) continue
    picked.push(row.id)
  }

  return picked
}
