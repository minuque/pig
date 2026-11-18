import type { ModelRef, ThinkingLevel } from "@/types/common-type.js"

export function sameModel(a: ModelRef | undefined, b: ModelRef | undefined): boolean {
  return a?.provider === b?.provider && a?.id === b?.id
}

/** 字符串 thinkingLevel → 官方 ThinkingLevel；未知值回退 "off"。 */
export function thinkingLevelOf(level: string): ThinkingLevel {
  return (["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const).includes(
    level as ThinkingLevel,
  )
    ? (level as ThinkingLevel)
    : "off"
}
