export type TaskStatus = "queued" | "running" | "completed" | "failed" | "stopped"

interface TaskBase {
  /** 稳定标识，带来源前缀：如 "agent:<工具调用 id>:<序号>"。 */
  id: string
  /** 一行标题：子代理名，或命令的简述。 */
  description: string
  status: TaskStatus
  error?: string
}

export interface AgentTask extends TaskBase {
  kind: "agent"
  /** 子会话 id；有它就能点开看过程。 */
  sessionId?: string
  /** 交给子代理的任务。 */
  prompt: string
  /** 最近几步工具调用的单行摘要。 */
  steps: string[]
  /** 子代理的最终回复。 */
  summary?: string
  tokens: number
}

/** 一个任务的进展；扩展产出，web 只按这个形状显示，不看工具名。 */
export type Task = AgentTask

/** 工具结果 details 里带任务时的形状。 */
export interface TaskDetails {
  tasks: Task[]
}
