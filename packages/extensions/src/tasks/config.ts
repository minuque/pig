import { homedir } from "node:os"
import { join } from "node:path"

/** 后台任务的规格都在这里；以后做设置入口只换这个对象的来源。 */
export const taskConfig = {
  /** 每个会话同时在跑的任务数；已结束的不占名额。 */
  maxRunning: 8,
  /** 界面与模型看到的输出末尾字符数。 */
  outputTailChars: 8000,
  /** 单个任务日志文件的字节上限；超出后停止写入，任务继续跑。 */
  logMaxBytes: 10 * 1024 * 1024,
  /** 日志目录：<logDir>/<会话 id>/<任务 id>.log。 */
  logDir: join(homedir(), ".pig", "tasks"),
}

export type TaskConfig = typeof taskConfig

/** 事件总线频道：扩展发任务列表，宿主发停止请求。 */
export const TASKS_CHANNEL = "pig:tasks"
export const TASK_STOP_CHANNEL = "pig:tasks:stop"
/** 任务结束通知的自定义消息类型。 */
export const TASK_MESSAGE = "pig.task"
