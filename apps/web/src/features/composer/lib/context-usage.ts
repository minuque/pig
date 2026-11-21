import { finiteTokens, type ContextUsage } from "@features/session/lib/context-usage.js"

export function formatTokenCount(tokens: number): string {
  const abs = finiteTokens(tokens)

  if (abs < 1000) return String(Math.round(abs))
  const kilo = abs / 1000

  if (abs < 100_000) return `${kilo.toFixed(1)}K`
  return `${Math.round(kilo)}K`
}

export function segmentShare(tokens: number, window: number): number {
  if (window <= 0 || !(tokens > 0)) return 0
  return Math.min(100, (tokens / window) * 100)
}

export function contextSeverity(percent: number): "warning" | "critical" | undefined {
  return percent >= 90 ? "critical" : percent >= 75 ? "warning" : undefined
}

export function contextUsageSummary(usage: ContextUsage): string {
  return `${formatTokenCount(usage.used)} / ${formatTokenCount(usage.window)} tokens`
}
