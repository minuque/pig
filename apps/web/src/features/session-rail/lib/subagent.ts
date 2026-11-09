import type { TranscriptItem } from "@/types/common-type.js"

export type SubagentStatus = "queued" | "running" | "done" | "failed" | "aborted"

/** subagent 工具 details 里的一个子任务；字段照 @pig/extensions 的 SubagentResult。 */
export interface SubagentTask {
  agent: string
  task: string
  status: SubagentStatus
  sessionId?: string
  steps: string[]
  output?: string
  error?: string
  tokens: number
}

const STATUSES = new Set<SubagentStatus>(["queued", "running", "done", "failed", "aborted"])
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

/** 读 subagent 工具结果的 details；形状不对就当没有，不抛错。 */
export function subagentTasks(details: unknown): SubagentTask[] {
  const results = record(details)?.results

  if (!Array.isArray(results)) return []
  return results.flatMap((raw): SubagentTask[] => {
    const item = record(raw)
    const status = item?.status as SubagentStatus

    if (!item || typeof item.agent !== "string" || !STATUSES.has(status)) return []
    const usage = record(item.usage)
    const tokens = Number(usage?.input ?? 0) + Number(usage?.output ?? 0)
    return [
      {
        agent: item.agent,
        task: typeof item.task === "string" ? item.task : "",
        status,
        ...(typeof item.sessionId === "string" ? { sessionId: item.sessionId } : {}),
        steps: Array.isArray(item.steps) ? item.steps.filter((s) => typeof s === "string") : [],
        ...(typeof item.output === "string" ? { output: item.output } : {}),
        ...(typeof item.error === "string" ? { error: item.error } : {}),
        tokens: Number.isFinite(tokens) ? tokens : 0,
      },
    ]
  })
}

/** 当前会话里最近一次 subagent 调用的子任务；摘要面板的 Task 块显示它。 */
export function latestSubagentTasks(transcript: readonly TranscriptItem[]): SubagentTask[] {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const item = transcript[index]

    if (item?.role === "tool" && item.toolName === "subagent") return subagentTasks(item.details)
  }

  return []
}
