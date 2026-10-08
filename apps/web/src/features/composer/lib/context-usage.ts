import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import { t } from "@i18n/index.js"
import type { ContextUsage } from "@features/composer/type.js"

function finiteTokens(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
}

const SEGMENT_DEFS = [
  {
    id: "systemPrompt" as const,
    label: () => t("composer.contextSystemPrompt"),
    color: "var(--primary)",
    previewable: true,
  },
  {
    id: "memory" as const,
    label: () => t("composer.contextMemory"),
    color: "var(--accent-skill)",
    previewable: true,
  },
  {
    id: "skills" as const,
    label: () => t("composer.contextSkills"),
    color: "var(--accent-steel)",
    previewable: true,
  },
  {
    id: "tools" as const,
    label: () => t("composer.contextToolDefs"),
    color: "var(--accent-teal)",
    previewable: true,
  },
  {
    id: "toolResults" as const,
    label: () => t("composer.contextToolResults"),
    color: "var(--warning)",
    previewable: true,
  },
  {
    id: "conversation" as const,
    label: () => t("composer.contextCurrentSession"),
    color: "var(--accent-green)",
    previewable: true,
  },
  {
    id: "other" as const,
    label: () => t("composer.contextOther"),
    color: "var(--accent-gray)",
    previewable: false,
  },
  {
    id: "idle" as const,
    label: () => t("composer.contextIdle"),
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

export function segmentShare(tokens: number, window: number): number {
  if (window <= 0 || !(tokens > 0)) return 0
  return Math.min(100, (tokens / window) * 100)
}

export function contextUsageSummary(usage: ContextUsage): string {
  return `${formatTokenCount(usage.used)} / ${formatTokenCount(usage.window)} tokens`
}
