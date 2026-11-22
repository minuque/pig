import type { ContextUsageEstimate, ContextUsageTokens } from "@/types/common-type.js"
import { t } from "@i18n/index.js"

export interface ContextUsageSegment {
  id:
    | "systemPrompt"
    | "memory"
    | "skills"
    | "tools"
    | "mcpTools"
    | "toolResults"
    | "conversation"
    | "other"
    | "idle"
  label: string
  tokens: number
  color: string
  previewable: boolean
}

export interface ContextUsageSessionTokens extends ContextUsageTokens {
  cacheHitRate: number | null
}

export interface ContextUsage {
  used: number
  window: number
  percent: number
  mcpToolCount: number
  tokens?: ContextUsageSessionTokens | undefined
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
    id: "mcpTools" as const,
    label: () => t("composer.contextMcpTools"),
    color: "var(--chart-mcp)",
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
    label: () => t("composer.contextMessages"),
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

export function projectSessionTokens(
  tokens: ContextUsageTokens | undefined,
): ContextUsageSessionTokens | undefined {
  if (!tokens) return undefined
  const input = finiteTokens(tokens.input)
  const cacheRead = finiteTokens(tokens.cacheRead)
  const cacheWrite = finiteTokens(tokens.cacheWrite)
  const prompt = input + cacheRead + cacheWrite
  return {
    input,
    output: finiteTokens(tokens.output),
    cacheRead,
    cacheWrite,
    total: finiteTokens(tokens.total),
    cacheHitRate: prompt > 0 ? Math.round((cacheRead / prompt) * 1000) / 10 : null,
  }
}

export function projectContextUsage(
  estimate: ContextUsageEstimate | undefined,
): ContextUsage | undefined {
  if (!estimate) return undefined

  const window = Math.max(0, estimate.window)
  const used = Math.max(0, estimate.used)
  const tokens = projectSessionTokens(estimate.tokens)
  return {
    used,
    window,
    percent: window <= 0 || used <= 0 ? 0 : Math.min(100, Math.round((used / window) * 100)),
    mcpToolCount: finiteTokens(estimate.mcpToolCount),
    ...(tokens ? { tokens } : {}),
    segments: SEGMENT_DEFS.map((def) => ({
      id: def.id,
      label: def.label(),
      tokens: finiteTokens(estimate.segments[def.id]),
      color: def.color,
      previewable: def.previewable,
    })),
  }
}
