import type { Task, TaskStatus, TranscriptItem } from "@/types/common-type.js"

const STATUSES = new Set<TaskStatus>(["queued", "running", "completed", "failed", "stopped"])
const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
const text = (value: unknown) => (typeof value === "string" ? value : undefined)
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

function parseTask(raw: unknown): Task | undefined {
  const item = record(raw)
  const id = text(item?.id)
  const description = text(item?.description)
  const status = item?.status as TaskStatus

  if (!item || id === undefined || description === undefined || !STATUSES.has(status))
    return undefined
  const error = text(item.error)
  const startedAt = number(item.startedAt)
  const completedAt = number(item.completedAt)
  const base = {
    id,
    description,
    status,
    ...(error === undefined ? {} : { error }),
    ...(startedAt === undefined ? {} : { startedAt }),
    ...(completedAt === undefined ? {} : { completedAt }),
  }

  if (item.kind === "agent") {
    const sessionId = text(item.sessionId)
    const summary = text(item.summary)
    return {
      ...base,
      kind: "agent",
      prompt: text(item.prompt) ?? "",
      steps: Array.isArray(item.steps) ? item.steps.filter((s) => typeof s === "string") : [],
      tokens: number(item.tokens) ?? 0,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(summary === undefined ? {} : { summary }),
    }
  }

  if (item.kind === "bash") {
    const exitCode = number(item.exitCode)
    return {
      ...base,
      kind: "bash",
      command: text(item.command) ?? "",
      output: text(item.output) ?? "",
      ...(exitCode === undefined ? {} : { exitCode }),
    }
  }

  return undefined
}

export function toolTasks(details: unknown): Task[] {
  const tasks = record(details)?.tasks
  return Array.isArray(tasks) ? tasks.flatMap((raw) => parseTask(raw) ?? []) : []
}

export function latestToolTasks(transcript: readonly TranscriptItem[]): Task[] {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const item = transcript[index]
    const tasks = item?.role === "tool" ? toolTasks(item.details) : []

    if (tasks.length) return tasks
  }

  return []
}

export function taskDetail(task: Task): string {
  if (task.error) return task.error
  return task.kind === "agent" ? (task.steps.at(-1) ?? task.prompt) : task.command
}
