import type { TranscriptItem } from "@/types/common-type.js"

/** 最后一条助手不是 error/aborted 才算干净收尾。 */
export function endedCleanly(items: readonly TranscriptItem[]): boolean {
  const last = items.findLast((item) => item.role === "assistant")
  return last?.role !== "assistant" || (last.status !== "error" && last.status !== "aborted")
}
