import type { SearchTruncation } from "@/types/common-type.js"

export function searchLimitNotice(reasons: readonly SearchTruncation[], count: number) {
  if (!reasons.length) return undefined

  if (reasons.every((reason) => reason === "result-limit"))
    return { key: "files.limitResults", count } as const

  if (reasons.includes("candidate-limit")) return { key: "files.limitPartial" } as const
  return { key: "files.limitIncomplete" } as const
}
