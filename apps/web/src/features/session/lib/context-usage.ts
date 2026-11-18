import type { ContextUsageEstimate } from "@/types/common-type.js"
import { t } from "@i18n/index.js"

export interface ContextUsageSegment {
  id:
    | "systemPrompt"
    | "memory"
    | "skills"
    | "tools"
    | "toolResults"
    | "conversation"
    | "other"
    | "idle"
  label: string
  tokens: number
  color: string
  previewable: boolean
}

export interface ContextUsage {
  used: number
  window: number
  percent: number
  segments: ContextUsageSegment[]
}

export function finiteTokens(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
}

const SEGMENT_DEFS = [
  {
    id: "systemPrompt" as const,
    label: () => t("composer.contextSystemPrompt"),
    color: "var(--chart-system)",
    previewable: true,
  },
  {
    id: "memory" as const,
    label: () => t("composer.contextMemory"),
    color: "var(--chart-memory)",
    previewable: true,
  },
  {
    id: "skills" as const,
    label: () => t("composer.contextSkills"),
    color: "var(--chart-skills)",
    previewable: true,
  },
  {
    id: "tools" as const,
    label: () => t("composer.contextToolDefs"),
    color: "var(--chart-tools)",
    previewable: true,
  },
  {
    id: "toolResults" as const,
    label: () => t("composer.contextToolResults"),
    color: "var(--chart-results)",
    previewable: true,
  },
  {
    id: "conversation" as const,
    label: () => t("composer.contextCurrentSession"),
    color: "var(--chart-conversation)",
    previewable: true,
  },
  {
    id: "other" as const,
    label: () => t("composer.contextOther"),
    color: "var(--chart-other)",
    previewable: false,
  },
  {
    id: "idle" as const,
    label: () => t("composer.contextIdle"),
    color: "var(--chart-free)",
    previewable: false,
  },
]

export function projectContextUsage(
  estimate: ContextUsageEstimate | undefined,
): ContextUsage | undefined {
  if (!estimate) return undefined

  const window = Math.max(0, estimate.window)
  const used = Math.max(0, estimate.used)
  return {
    used,
    window,
    percent: window <= 0 || used <= 0 ? 0 : Math.min(100, Math.round((used / window) * 100)),
    segments: SEGMENT_DEFS.map((def) => ({
      id: def.id,
      label: def.label(),
      tokens: finiteTokens(estimate.segments[def.id]),
      color: def.color,
      previewable: def.previewable,
    })),
  }
}
