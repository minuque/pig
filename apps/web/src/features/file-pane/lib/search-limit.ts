import type { SearchTruncation } from "@/types/common-type.js"

/** 照 cc-wrapper 的 searchLimitMessage：按没搜全的原因选一句提示；没截断返回 undefined。 */
export function searchLimitNotice(reasons: readonly SearchTruncation[], count: number) {
  if (!reasons.length) return undefined

  if (reasons.every((reason) => reason === "result-limit"))
    return { key: "files.limitResults", count } as const

  if (reasons.includes("candidate-limit")) return { key: "files.limitPartial" } as const
  return { key: "files.limitIncomplete" } as const
}
