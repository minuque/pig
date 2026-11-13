import type { Task } from "@pig/protocol"

/** 登记表往外说话的两条路：任务列表给宿主，结束通知给会话。 */
export interface TaskHost {
  publish(tasks: Task[]): void
  notify(task: Task, wake: boolean): void
}

type Entry = { task: Task; abort(): void }

const PUBLISH_DELAY_MS = 100

/** 一个会话的后台任务：登记、更新、结束、停止。任务一旦结束就不再变。 */
export class TaskRegistry {
  private readonly entries = new Map<string, Entry>()
  private host: TaskHost | undefined
  private timer: ReturnType<typeof setTimeout> | undefined

  bind(host: TaskHost) {
    this.host = host
  }

  list(): Task[] {
    return [...this.entries.values()].map((entry) => structuredClone(entry.task))
  }

  get(id: string): Task | undefined {
    return this.entries.get(id)?.task
  }

  runningCount(): number {
    return [...this.entries.values()].filter((entry) => entry.task.status === "running").length
  }

  add(task: Task, abort: () => void) {
    this.entries.set(task.id, { task, abort })
    this.publishNow()
  }

  /** 进行中的更新（输出、步骤）：合并后再发，不逐块发。 */
  patch(id: string, patch: Partial<Task>) {
    const entry = this.entries.get(id)

    if (!entry || entry.task.status !== "running") return
    Object.assign(entry.task, patch)
    this.timer ??= setTimeout(() => this.publishNow(), PUBLISH_DELAY_MS)
  }

  /** 结束一个任务并通知会话；已经结束的任务不会被改写。 */
  finish(id: string, patch: Partial<Task>, wake: boolean) {
    const entry = this.entries.get(id)

    if (!entry || entry.task.status !== "running") return
    Object.assign(entry.task, patch, { completedAt: Date.now() })
    this.publishNow()
    this.host?.notify(structuredClone(entry.task), wake)
  }

  /** 主动停止：先记为已停止，再中止命令；不叫醒模型。 */
  stop(id: string): boolean {
    const entry = this.entries.get(id)

    if (!entry || entry.task.status !== "running") return false
    this.finish(id, { status: "stopped" }, false)
    entry.abort()
    return true
  }

  stopAll() {
    for (const id of [...this.entries.keys()]) this.stop(id)
  }

  private publishNow() {
    clearTimeout(this.timer)
    this.timer = undefined
    this.host?.publish(this.list())
  }
}

/** 挂在 globalThis 上：各扩展经 jiti 加载可能是不同的模块实例，同一会话仍共用一份登记表。 */
const REGISTRIES = Symbol.for("pig.tasks.registries")
const registries = ((globalThis as { [REGISTRIES]?: Map<string, TaskRegistry> })[REGISTRIES] ??=
  new Map())

export function registryFor(sessionId: string): TaskRegistry {
  const existing = registries.get(sessionId)

  if (existing) return existing
  const created = new TaskRegistry()
  registries.set(sessionId, created)
  return created
}

export function dropRegistry(sessionId: string) {
  registries.delete(sessionId)
}
