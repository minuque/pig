import { defaultTaskLogRoot } from "@pig/environment/source"
import type { TaskChannels } from "@pig/protocol"

export const taskConfig = {
  maxRunning: 8,
  outputTailChars: 8000,
  logMaxBytes: 10 * 1024 * 1024,
  /** 日志目录：<logDir>/<会话 id>/<任务 id>.log。 */
  logDir: defaultTaskLogRoot(),
}

export type TaskConfig = typeof taskConfig

export const TASKS_CHANNEL = "pig:tasks" satisfies keyof TaskChannels
export const TASK_STOP_CHANNEL = "pig:tasks:stop" satisfies keyof TaskChannels
export const TASK_MESSAGE = "pig.task"
