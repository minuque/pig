import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type { ContextUsage } from "@features/composer/type.js"

function finiteTokens(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
}

const SEGMENT_DEFS = [
  { id: "systemPrompt" as const, label: "系统提示词", color: "var(--primary)", previewable: true },
  { id: "memory" as const, label: "记忆", color: "var(--accent-dusk)", previewable: true },
  { id: "skills" as const, label: "技能", color: "var(--accent-twilight)", previewable: true },
  { id: "tools" as const, label: "工具定义", color: "var(--accent-sunset)", previewable: true },
  {
    id: "toolResults" as const,
    label: "工具结果",
    color: "var(--accent-orange)",
    previewable: true,
  },
  {
    id: "conversation" as const,
    label: "当前会话上下文",
    color: "var(--accent-green)",
    previewable: true,
  },
  { id: "other" as const, label: "其他", color: "var(--accent-breeze)", previewable: false },
  {
    id: "idle" as const,
    label: "空闲",
    color: "var(--hover-strong)",
    previewable: false,
  },
]

/** <1K 整数；1K–100K 一位小数；更大取整。 */
export function formatTokenCount(tokens: number): string {
  const abs = finiteTokens(tokens)
  if (abs < 1000) return String(Math.round(abs))
  const kilo = abs / 1000
  if (abs < 100_000) return `${kilo.toFixed(1)}K`
  return `${Math.round(kilo)}K`
}

export function contextUsagePercent(used: number, window: number): number {
  if (window <= 0 || used <= 0) return 0
  return Math.min(100, Math.round((used / window) * 100))
}

export function projectContextUsage(
  estimate: ContextUsageEstimate | undefined,
): ContextUsage | undefined {
  if (!estimate) return undefined

  const window = Math.max(0, estimate.window)
  const used = Math.max(0, estimate.used)

  return {
    used,
    window,
    percent: contextUsagePercent(used, window),
    segments: SEGMENT_DEFS.map((def) => ({
      id: def.id,
      label: def.label,
      tokens: finiteTokens(estimate.segments[def.id]),
      color: def.color,
      previewable: def.previewable,
    })),
  }
}

export function segmentShare(tokens: number, window: number): number {
  if (window <= 0 || !(tokens > 0)) return 0
  return Math.min(100, (tokens / window) * 100)
}

export function contextUsageSummary(usage: ContextUsage): string {
  return `${formatTokenCount(usage.used)} / ${formatTokenCount(usage.window)} tokens`
}
