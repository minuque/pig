export type TaskStatus = "queued" | "running" | "completed" | "failed" | "stopped"

interface TaskBase {
  /** 稳定标识，带来源前缀：如 "agent:<工具调用 id>:<序号>"、"bash:<随机 id>"。 */
  id: string
  /** 一行标题：子代理名，或命令的简述。 */
  description: string
  status: TaskStatus
  /** 毫秒时间戳。 */
  startedAt?: number
  completedAt?: number
  error?: string
}

export interface AgentTask extends TaskBase {
  kind: "agent"
  /** 子会话 id；有它就能点开看过程。 */
  sessionId?: string
  prompt: string
  /** 最近几步工具调用的单行摘要。 */
  steps: string[]
  summary?: string
  tokens: number
}

export interface BashTask extends TaskBase {
  kind: "bash"
  command: string
  /** 只留输出末尾。 */
  output: string
  exitCode?: number | null
  /** 完整输出的日志文件，在 gateway 所在的机器上。 */
  logPath?: string
}

/** 一个任务的进展；扩展产出，web 只按这个形状显示，不看工具名。 */
export type Task = AgentTask | BashTask

/** 工具结果 details 里带任务时的形状。 */
export interface TaskDetails {
  tasks: Task[]
}

/** 扩展经 pi.events 发给宿主的后台任务列表。 */
export interface TasksEvent {
  sessionId: string
  tasks: Task[]
}

/** 宿主经 pi.events 请求停止一个后台任务。 */
export interface TaskStopEvent {
  sessionId: string
  taskId: string
}

/** 后台任务的事件总线频道名 → 载荷；扩展与宿主的频道常量都要对上这里。 */
export interface TaskChannels {
  "pig:tasks": TasksEvent
  "pig:tasks:stop": TaskStopEvent
}
