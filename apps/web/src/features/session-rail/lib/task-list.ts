import { readJson, writeJson, type PrefStorage } from "@utils/storage.js"
import { formatElapsed } from "@utils/time.js"
import type { Task } from "@/types/common-type.js"

const DISMISSED_KEY = "pig.rail.dismissedTasks"
const MAX_IDS = 1000
const MAX_SESSIONS = 100
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g")

export function mergeTasks(background: readonly Task[], foreground: readonly Task[]): Task[] {
  const ids = new Set(background.map((task) => task.id))
  return [...background, ...foreground.filter((task) => !ids.has(task.id))]
}

export function taskSections(tasks: readonly Task[]) {
  const active = (task: Task) => task.status === "running" || task.status === "queued"
  return {
    running: tasks
      .filter(active)
      .sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity)),
    finished: tasks
      .filter((task) => !active(task))
      .sort((a, b) => (b.completedAt ?? -Infinity) - (a.completedAt ?? -Infinity)),
  }
}

export type TaskSections = ReturnType<typeof taskSections>

export function visibleSections(
  tasks: readonly Task[],
  dismissed: readonly string[],
): TaskSections {
  const hidden = new Set(dismissed)
  return taskSections(tasks.filter((task) => task.status === "running" || !hidden.has(task.id)))
}

export function taskElapsed(task: Task, now: number): string {
  if (task.startedAt === undefined) return ""
  const end = task.status === "running" ? now : task.completedAt
  return end === undefined ? "" : formatElapsed(end - task.startedAt, { showMs: false })
}

export function plainOutput(output: string): string {
  return output.replace(ANSI, "")
}

export function readDismissed(sessionId: string, storage?: PrefStorage): string[] {
  const map = readJson<Record<string, string[]>>(DISMISSED_KEY, storage)
  const ids = map?.[sessionId]
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []
}

export function dismissTasks(sessionId: string, ids: readonly string[], storage?: PrefStorage) {
  const map = readJson<Record<string, string[]>>(DISMISSED_KEY, storage) ?? {}
  const others = Object.entries(map)
    .filter(([id]) => id !== sessionId)
    .slice(-(MAX_SESSIONS - 1))
  const next = [...new Set([...readDismissed(sessionId, storage), ...ids])].slice(-MAX_IDS)

  writeJson(DISMISSED_KEY, { ...Object.fromEntries(others), [sessionId]: next }, storage)
  return next
}
