export interface ContextUsageEstimate {
  used: number
  window: number
  segments: {
    systemPrompt: number
    memory: number
    skills: number
    tools: number
    toolResults: number
    conversation: number
    other: number
    idle: number
  }
}

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
}

export interface ContextUsage {
  used: number
  window: number
  percent: number
  segments: ContextUsageSegment[]
}

/** 欢迎页不传 cwd/usage，不展示底栏。 */
export function shouldShowComposerMeta(
  cwd: string | undefined,
  usage: ContextUsage | undefined,
): boolean {
  return cwd !== undefined || usage !== undefined
}

const SEGMENT_DEFS = [
  { id: "systemPrompt" as const, label: "系统提示词", color: "var(--primary)" },
  { id: "memory" as const, label: "记忆", color: "var(--accent-dusk)" },
  { id: "skills" as const, label: "Skills", color: "var(--accent-twilight)" },
  { id: "tools" as const, label: "Tool 定义", color: "var(--accent-sunset)" },
  { id: "toolResults" as const, label: "Tool 结果", color: "var(--accent-orange)" },
  {
    id: "conversation" as const,
    label: "当前会话上下文",
    color: "var(--accent-green)",
  },
  { id: "other" as const, label: "其他", color: "var(--accent-breeze)" },
  {
    id: "idle" as const,
    label: "空闲",
    color: "color-mix(in srgb, var(--ink) 12%, transparent)",
  },
]

/** <1K 整数；1K–100K 一位小数；更大取整。 */
export function formatTokenCount(tokens: number): string {
  const abs = Math.max(0, tokens)
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
      tokens: Math.max(0, estimate.segments[def.id]),
      color: def.color,
    })),
  }
}

export function segmentShare(tokens: number, window: number): number {
  if (window <= 0 || tokens <= 0) return 0
  return Math.min(100, (tokens / window) * 100)
}

const PREVIEWABLE = new Set<ContextUsageSegment["id"]>([
  "systemPrompt",
  "memory",
  "skills",
  "tools",
  "toolResults",
  "conversation",
])

export function canPreviewSegment(id: ContextUsageSegment["id"]): boolean {
  return PREVIEWABLE.has(id)
}
