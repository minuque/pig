import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent"
import { environmentFor, type Environment } from "@pig/environment/source"
import type { Task, TaskStopEvent, TasksEvent } from "@pig/protocol"

import { fromEntries } from "../remote-workspace/index.ts"
import { startBashTask } from "./bash.ts"
import {
  TASK_MESSAGE,
  TASK_STOP_CHANNEL,
  TASKS_CHANNEL,
  taskConfig,
  type TaskConfig,
} from "./config.ts"
import { dropRegistry, registryFor } from "./registry.ts"

type Ctx = Pick<ExtensionContext, "cwd" | "sessionManager">

/** 命令在哪里跑：会话绑定了远程 workspace 就在那台主机，否则在本机。 */
export interface TaskWorkspace {
  env: Environment
  cwd: string
  remote: boolean
}

function workspaceOf(ctx: Ctx): TaskWorkspace {
  const binding = fromEntries(ctx)
  return binding
    ? { env: environmentFor(binding.environment), cwd: binding.path, remote: true }
    : { env: environmentFor("local"), cwd: ctx.cwd, remote: false }
}

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }], details: {} })

/** 给模型读的任务状态：一行结论，加日志路径（本机才给）和输出末尾。 */
function report(task: Task, remote: boolean): string {
  const lines = [`Background task ${task.id} (${task.description}): ${task.status}`]

  if (task.kind === "bash") {
    if (typeof task.exitCode === "number") lines[0] += `, exit code ${task.exitCode}`

    if (task.error) lines.push(task.error)

    if (task.logPath && !remote) lines.push(`Full output: ${task.logPath}`)
    lines.push(task.output ? `Output (tail):\n${task.output}` : "No output.")
  } else {
    if (task.error) lines.push(task.error)

    if (task.summary) lines.push(task.summary)
  }

  return lines.join("\n")
}

/** 后台任务：命令在会话里继续跑，工具调用立刻返回；结束时通知会话并叫醒模型。 */
export function createTasksExtension(
  deps: { config?: TaskConfig; workspace?: (ctx: Ctx) => TaskWorkspace } = {},
) {
  const config = deps.config ?? taskConfig
  const workspace = deps.workspace ?? workspaceOf
  return function tasks(pi: ExtensionAPI) {
    let offStop: (() => void) | undefined
    const sessionOf = (ctx: Ctx) => ctx.sessionManager.getSessionId()

    pi.on("session_start", (_event, ctx) => {
      const sessionId = sessionOf(ctx)
      const remote = workspace(ctx).remote

      registryFor(sessionId).bind({
        publish: (list) => pi.events.emit(TASKS_CHANNEL, { sessionId, tasks: list } as TasksEvent),
        notify: (task, wake) =>
          pi.sendMessage(
            {
              customType: TASK_MESSAGE,
              content: report(task, remote),
              display: true,
              details: task,
            },
            wake ? { triggerTurn: true, deliverAs: "followUp" } : { triggerTurn: false },
          ),
      })
      offStop?.()
      offStop = pi.events.on(TASK_STOP_CHANNEL, (data) => {
        const event = data as TaskStopEvent

        if (event.sessionId === sessionId) registryFor(sessionId).stop(event.taskId)
      })
    })

    pi.on("session_shutdown", (_event, ctx) => {
      registryFor(sessionOf(ctx)).stopAll()
      dropRegistry(sessionOf(ctx))
      offStop?.()
      offStop = undefined
    })

    const tool = (definition: {
      name: string
      label: string
      description: string
      properties: Record<string, unknown>
      required: string[]
      run(params: Record<string, unknown>, ctx: Ctx): string
    }) =>
      pi.registerTool({
        name: definition.name,
        label: definition.label,
        description: definition.description,
        parameters: {
          type: "object",
          properties: definition.properties,
          required: definition.required,
        } as never,
        execute: async (_id, params, _signal, _update, ctx) =>
          text(definition.run(params as Record<string, unknown>, ctx)),
      } as ToolDefinition)

    tool({
      name: "bg_task_start",
      label: "Start background task",
      description: [
        "Start a shell command in the background and return its task id immediately.",
        "Use for dev servers, test runs, builds and other long commands that should not block the conversation.",
        "You are notified when the command exits. Read output with bg_task_output, stop it with bg_task_stop.",
        "Give a timeout to commands that should end on their own (tests, builds); omit it for commands that stay up (servers, watchers).",
      ].join(" "),
      properties: {
        command: { type: "string", description: "Shell command to run" },
        description: { type: "string", description: "Short title shown to the user" },
        timeout: {
          type: "number",
          description: "Seconds before the command is terminated. Omit for no limit",
        },
      },
      required: ["command", "description"],
      run(params, ctx) {
        const registry = registryFor(sessionOf(ctx))

        if (registry.runningCount() >= config.maxRunning)
          return `Too many background tasks running (limit ${config.maxRunning}). Stop one with bg_task_stop or wait for one to finish.`
        const { env, cwd } = workspace(ctx)
        const timeout =
          typeof params.timeout === "number" && params.timeout > 0 ? params.timeout : 0
        const task = startBashTask(registry, config, {
          sessionId: sessionOf(ctx),
          env,
          cwd,
          command: String(params.command),
          description: String(params.description),
          ...(timeout ? { timeout } : {}),
        })
        return `Started background task ${task.id}. You will be notified when it exits.`
      },
    })

    tool({
      name: "bg_task_output",
      label: "Background task output",
      description: "Read the status, exit code and latest output of a background task.",
      properties: { id: { type: "string", description: "Task id returned by bg_task_start" } },
      required: ["id"],
      run(params, ctx) {
        const task = registryFor(sessionOf(ctx)).get(String(params.id))
        return task ? report(task, workspace(ctx).remote) : `Unknown task: ${String(params.id)}`
      },
    })

    tool({
      name: "bg_task_stop",
      label: "Stop background task",
      description: "Stop a running background task.",
      properties: { id: { type: "string", description: "Task id returned by bg_task_start" } },
      required: ["id"],
      run(params, ctx) {
        const id = String(params.id)
        return registryFor(sessionOf(ctx)).stop(id)
          ? `Stopped background task ${id}.`
          : `Task ${id} is not running.`
      },
    })
  }
}

export default createTasksExtension()
