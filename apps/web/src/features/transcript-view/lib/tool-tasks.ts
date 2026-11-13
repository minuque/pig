import type { Task, TaskStatus, TranscriptItem } from "@/types/common-type.js"

const STATUSES = new Set<TaskStatus>(["queued", "running", "completed", "failed", "stopped"])
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

/** 读工具结果 details 里的任务；只认形状不认工具名，形状不对就当没有，不抛错。 */
export function toolTasks(details: unknown): Task[] {
  const tasks = record(details)?.tasks

  if (!Array.isArray(tasks)) return []
  return tasks.flatMap((raw): Task[] => {
    const item = record(raw)

    if (
      !item ||
      item.kind !== "agent" ||
      typeof item.id !== "string" ||
      typeof item.description !== "string" ||
      !STATUSES.has(item.status as TaskStatus)
    )
      return []
    return [
      {
        id: item.id,
        kind: "agent",
        description: item.description,
        status: item.status as TaskStatus,
        prompt: typeof item.prompt === "string" ? item.prompt : "",
        steps: Array.isArray(item.steps) ? item.steps.filter((s) => typeof s === "string") : [],
        tokens: typeof item.tokens === "number" && Number.isFinite(item.tokens) ? item.tokens : 0,
        ...(typeof item.sessionId === "string" ? { sessionId: item.sessionId } : {}),
        ...(typeof item.summary === "string" ? { summary: item.summary } : {}),
        ...(typeof item.error === "string" ? { error: item.error } : {}),
      },
    ]
  })
}

/** 当前会话里最近一次带任务的工具调用；摘要面板的 Task 块显示它。 */
export function latestToolTasks(transcript: readonly TranscriptItem[]): Task[] {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const item = transcript[index]
    const tasks = item?.role === "tool" ? toolTasks(item.details) : []

    if (tasks.length) return tasks
  }

  return []
}
