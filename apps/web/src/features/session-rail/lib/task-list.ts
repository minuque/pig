import { readJson, writeJson, type PrefStorage } from "@utils/storage.js"
import type { Task } from "@/types/common-type.js"

const DISMISSED_KEY = "pig.rail.dismissedTasks"
/** 每个会话最多记这么多条已清除的任务 id；更早的会话整条丢掉。 */
const MAX_IDS = 1000
const MAX_SESSIONS = 100
/** 终端控制序列：颜色、光标移动等。 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g")

/** 后台任务排在前，时间线工具里的任务补在后；同一个 id 只留后台那份。 */
export function mergeTasks(background: readonly Task[], foreground: readonly Task[]): Task[] {
  const ids = new Set(background.map((task) => task.id))
  return [...background, ...foreground.filter((task) => !ids.has(task.id))]
}

/** 分两段：进行中按开始时间，已结束按结束时间倒序。 */
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

/** 去掉终端颜色码，只留文字。 */
export function plainOutput(output: string): string {
  return output.replace(ANSI, "")
}

export function readDismissed(sessionId: string, storage?: PrefStorage): string[] {
  const map = readJson<Record<string, string[]>>(DISMISSED_KEY, storage)
  const ids = map?.[sessionId]
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []
}

/** 清除已结束的任务：只是界面上隐藏，按会话记在本地。 */
export function dismissTasks(sessionId: string, ids: readonly string[], storage?: PrefStorage) {
  const map = readJson<Record<string, string[]>>(DISMISSED_KEY, storage) ?? {}
  const others = Object.entries(map)
    .filter(([id]) => id !== sessionId)
    .slice(-(MAX_SESSIONS - 1))
  const next = [...new Set([...readDismissed(sessionId, storage), ...ids])].slice(-MAX_IDS)

  writeJson(DISMISSED_KEY, { ...Object.fromEntries(others), [sessionId]: next }, storage)
  return next
}
