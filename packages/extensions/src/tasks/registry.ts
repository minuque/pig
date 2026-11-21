import type { Task } from "@pig/protocol"

export interface TaskHost {
  publish(tasks: Task[]): void
  notify(task: Task, wake: boolean): void
}

type Entry = { task: Task; abort(): void }

const PUBLISH_DELAY_MS = 100
const KEEP_FINISHED = 20
const live = (entry: Entry | undefined): entry is Entry =>
  entry?.task.status === "queued" || entry?.task.status === "running"

export class TaskRegistry {
  private readonly entries = new Map<string, Entry>()
  private host: TaskHost | undefined
  private timer: ReturnType<typeof setTimeout> | undefined

  bind(host: TaskHost) {
    this.host = host
  }

  hasHost(): boolean {
    return this.host !== undefined
  }

  list(): Task[] {
    return [...this.entries.values()].map((entry) => structuredClone(entry.task))
  }

  get(id: string): Task | undefined {
    return this.entries.get(id)?.task
  }

  runningCount(): number {
    return [...this.entries.values()].filter(live).length
  }

  add(task: Task, abort: () => void) {
    this.entries.set(task.id, { task, abort })
    this.publishNow()
  }

  patch(id: string, patch: Partial<Task>) {
    const entry = this.entries.get(id)

    if (!live(entry)) return
    Object.assign(entry.task, patch)
    this.timer ??= setTimeout(() => this.publishNow(), PUBLISH_DELAY_MS)
  }

  finish(id: string, patch: Partial<Task>, wake: boolean) {
    const entry = this.entries.get(id)

    if (!live(entry)) return
    Object.assign(entry.task, patch, { completedAt: Date.now() })
    this.host?.notify(structuredClone(entry.task), wake)
    this.prune()
    this.publishNow()
  }

  stop(id: string): boolean {
    const entry = this.entries.get(id)

    if (!live(entry)) return false
    this.finish(id, { status: "stopped" }, false)
    entry.abort()
    return true
  }

  stopAll() {
    for (const id of [...this.entries.keys()]) this.stop(id)
  }

  private prune() {
    const finished = [...this.entries].filter(([, entry]) => !live(entry))

    for (const [id] of finished.slice(0, -KEEP_FINISHED)) this.entries.delete(id)
  }

  private publishNow() {
    clearTimeout(this.timer)
    this.timer = undefined
    this.host?.publish(this.list())
  }
}

// 外部：扩展经 jiti 加载可能得到不同模块实例，登记表挂 globalThis 才能共用
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
