import type { TranscriptItem } from "@/types/common-type.js"

export function endedCleanly(items: readonly TranscriptItem[]): boolean {
  const last = items.findLast((item) => item.role === "assistant")
  return last?.role !== "assistant" || (last.status !== "error" && last.status !== "aborted")
}
