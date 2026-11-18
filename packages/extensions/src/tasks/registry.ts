import type { Task } from "@pig/protocol"

/** 登记表往外说话的两条路：任务列表给宿主，结束通知给会话。 */
export interface TaskHost {
  publish(tasks: Task[]): void
  notify(task: Task, wake: boolean): void
}

type Entry = { task: Task; abort(): void }

const PUBLISH_DELAY_MS = 100
/** 已结束的任务只留最近这么多条；更早的从登记表删掉，日志文件仍在。 */
const KEEP_FINISHED = 20
/** 排队中的任务也算在跑：占名额，可以停止。 */
const live = (entry: Entry | undefined): entry is Entry =>
  entry?.task.status === "queued" || entry?.task.status === "running"

/** 一个会话的后台任务：登记、更新、结束、停止。任务一旦结束就不再变。 */
export class TaskRegistry {
  private readonly entries = new Map<string, Entry>()
  private host: TaskHost | undefined
  private timer: ReturnType<typeof setTimeout> | undefined

  bind(host: TaskHost) {
    this.host = host
  }

  /** tasks 扩展起来后才有宿主；没有宿主时结束了也没人通知会话。 */
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

  /** 进行中的更新（输出、步骤）：合并后再发，不逐块发。 */
  patch(id: string, patch: Partial<Task>) {
    const entry = this.entries.get(id)

    if (!live(entry)) return
    Object.assign(entry.task, patch)
    this.timer ??= setTimeout(() => this.publishNow(), PUBLISH_DELAY_MS)
  }

  /** 结束一个任务并通知会话；已经结束的任务不会被改写。 */
  finish(id: string, patch: Partial<Task>, wake: boolean) {
    const entry = this.entries.get(id)

    if (!live(entry)) return
    Object.assign(entry.task, patch, { completedAt: Date.now() })
    // 先通知：叫醒让会话先忙起来，宿主收到「没有在跑的任务」时才不会销毁会话
    this.host?.notify(structuredClone(entry.task), wake)
    this.prune()
    this.publishNow()
  }

  /** 主动停止：先记为已停止，再中止命令；不叫醒模型。 */
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
